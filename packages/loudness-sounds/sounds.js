// Sound labeling — Audacity "Label Sounds" analyzer:
// 10 ms chunks classed sound/silence by level vs threshold → grouped, short gaps closed,
// short regions folded forward, then padded into adjacent silence (per side, sound-bounded).
// https://manual.audacityteam.org/man/label_sounds.html

const CHUNK = 0.01 // Audacity: "10 ms chunks, intervals of 0.01 seconds"

/**
 * @param {Float32Array|Float32Array[]} channels
 * @param {object} opts — { fs=48000, threshold=-30, measurement='peak'|'avg'|'rms',
 *   minSilence=1, minSound=1, pre=0, post=0, max=10000 }
 * @returns {{at:number, duration:number, label:string}[]}
 */
export default function sounds (channels, { fs = 48000, threshold = -30, measurement = 'peak', minSilence = 1, minSound = 1, pre = 0, post = 0, max = 10000 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let n = channels[0]?.length || 0
	let chunkLen = Math.max(1, Math.round(CHUNK * fs))
	let dur = n / fs

	// per-chunk level → sound/silence
	let regions = []
	let start = null
	for (let i = 0; i < n; i += chunkLen) {
		let e = Math.min(i + chunkLen, n)
		let level = chunkLevel(channels, i, e, measurement)
		let db = level > 0 ? 20 * Math.log10(level) : -Infinity
		if (db >= threshold) { if (start === null) start = i }
		else if (start !== null) { regions.push({ start: start / fs, end: i / fs }); start = null }
	}
	if (start !== null) regions.push({ start: start / fs, end: n / fs })

	// close gaps shorter than minSilence
	let closed = []
	for (let r of regions) {
		let last = closed[closed.length - 1]
		if (last && r.start - last.end < minSilence) last.end = r.end
		else closed.push({ start: r.start, end: r.end })
	}

	// fold regions shorter than minSound into the following one (gap included); a trailing short region stays
	let folded = []
	for (let i = 0; i < closed.length; i++) {
		let r = { start: closed[i].start, end: closed[i].end }
		while (r.end - r.start < minSound && i + 1 < closed.length) r.end = closed[++i].end
		folded.push(r)
	}

	// pad into adjacent silence — each side independently, against the neighbouring *sound*
	// boundary: labels may overlap other labels, never sounds or [0, dur]
	// (manual: "labels can overlap other labels, but cannot overlap previous or following sounds")
	let raw = folded.map(r => ({ start: r.start, end: r.end }))
	for (let i = 0; i < folded.length; i++) {
		let r = folded[i]
		let prevEnd = i > 0 ? raw[i - 1].end : 0
		let nextStart = i + 1 < folded.length ? raw[i + 1].start : dur
		r.start -= Math.min(pre, Math.max(0, raw[i].start - prevEnd))
		r.end += Math.min(post, Math.max(0, nextStart - raw[i].end))
	}

	return folded.slice(0, max).map((r, i) => ({ at: r.start, duration: r.end - r.start, label: `Sound ${i + 1}` }))
}

// level across channels in [i, e) — 'peak' = max |x|, 'avg' = mean |x|, 'rms' = sqrt(mean x²)
function chunkLevel (channels, i, e, measurement) {
	let acc = 0, count = 0
	for (let c = 0; c < channels.length; c++) {
		let ch = channels[c]
		for (let j = i; j < e; j++) {
			let v = ch[j]
			acc = measurement === 'peak' ? Math.max(acc, Math.abs(v)) : acc + (measurement === 'rms' ? v * v : Math.abs(v))
		}
		count += e - i
	}
	if (measurement === 'peak') return acc
	if (measurement === 'rms') return count ? Math.sqrt(acc / count) : 0
	return count ? acc / count : 0
}
