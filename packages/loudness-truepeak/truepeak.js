// True peak (dBTP) — inter-sample peak via 4× windowed-sinc oversampling,
// per ITU-R BS.1770-4 Annex 2 methodology (generic sinc interpolator).
// Polyphase: the points between samples read the signal through fixed 32-tap Lanczos kernels, the kernel
// @audio/resample-sinc upsamples with, made once per integer factor; the samples themselves are phase 0.
// Near the ends, taps outside the signal drop and the rest renormalize, as the resampler does.
// A point between samples reads at most its window's largest sample times the kernel's absolute sum (`gain`), so
// blocks whose neighbourhood stays below the peak found so far can't raise it and are skipped, loudest blocks first.
// Within a block, a point whose four nearest taps, plus the rest of the kernel at the block's largest sample
// (`far`), can't pass the peak either is skipped before its full read. The blocks at the ends, where reads reach past
// the signal and the kernel renormalizes, are always read in full.

import resample from '@audio/resample-sinc'

const HALF = 16, TAPS = 2 * HALF, BLOCK = 64
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)

// Per phase p/n (0 < p < n): raw weights of taps 1−HALF … HALF, and the same scaled to sum 1; `gain`, the largest
// absolute sum of any phase's scaled weights, bounds what a read away from the ends can reach
const kernels = new Map()
function phases (n) {
	if (kernels.has(n)) return kernels.get(n)
	let list = [], gain = 1
	for (let p = 1; p < n; p++) {
		let raw = new Float64Array(TAPS), sum = 0
		for (let j = 0; j < TAPS; j++) { let x = j + 1 - HALF - p / n; sum += raw[j] = sinc(x) * sinc(x / HALF) }
		let unit = raw.map(k => k / sum), far = unit.reduce((a, k, j) => j >= HALF - 2 && j <= HALF + 1 ? a : a + Math.abs(k), 0)
		gain = Math.max(gain, unit.reduce((a, k) => a + Math.abs(k), 0))
		list.push({ raw, unit, far })
	}
	let kernel = { list, gain }
	kernels.set(n, kernel)
	return kernel
}

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, oversample=4 }
 * @returns {number} true peak in dBTP (−Infinity for silence)
 */
export default function truepeak (channels, { fs = 48000, oversample = 4 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let peak = 0
	for (let ch of channels) {
		let len = ch.length
		for (let i = 0; i < len; i++) { let a = Math.abs(ch[i]); if (a > peak) peak = a }
		if (!Number.isInteger(oversample)) {
			let up = resample(ch, { from: fs, to: fs * oversample })
			for (let i = 0; i < up.length; i++) { let a = Math.abs(up[i]); if (a > peak) peak = a }
			continue
		}
		let { list, gain } = phases(oversample), blocks = Math.ceil(len / BLOCK), top = new Float64Array(blocks)
		for (let i = 0; i < len; i++) { let a = Math.abs(ch[i]), b = i / BLOCK | 0; if (a > top[b]) top[b] = a }
		// a block's reads reach HALF samples into its neighbours
		let reach = Float64Array.from(top, (t, b) => Math.max(t, top[b - 1] || 0, top[b + 1] || 0))
		let order = Uint32Array.from(reach.keys()).sort((a, b) => reach[b] - reach[a])
		// the ends first: their renormalized reads aren't bounded by gain. A read at `base` reaches HALF − 1 samples back
		// and HALF on, so the ends are the blocks holding the first HALF − 1 bases and the last HALF.
		let head = Math.floor((HALF - 2) / BLOCK), tail = Math.max(0, Math.floor((len - HALF) / BLOCK))
		let ends = Array.from({ length: blocks }, (_, b) => b).filter(b => b <= head || b >= tail)
		for (let b of new Set([...ends, ...order])) {
			if (b > head && b < tail && reach[b] * gain <= peak) break
			for (let { raw, unit, far } of list) {
				let rest = far * reach[b], u0 = unit[HALF - 2], u1 = unit[HALF - 1], u2 = unit[HALF], u3 = unit[HALF + 1]
				for (let base = b * BLOCK, end = Math.min(len, base + BLOCK); base < end; base++) {
					let lo = base + 1 - HALF, v = 0
					if (lo >= 0 && lo + TAPS <= len) {
						if (Math.abs(ch[base - 1] * u0 + ch[base] * u1 + ch[base + 1] * u2 + ch[base + 2] * u3) + rest <= peak) continue
						// four running sums: independent adds pipeline
						let a = 0, c = 0, d = 0, e = 0
						for (let j = 0; j < TAPS; j += 4) { a += ch[lo + j] * unit[j]; c += ch[lo + j + 1] * unit[j + 1]; d += ch[lo + j + 2] * unit[j + 2]; e += ch[lo + j + 3] * unit[j + 3] }
						v = a + c + d + e
					} else {
						let sum = 0, w = 0
						for (let j = 0; j < TAPS; j++) { let i = lo + j; if (i >= 0 && i < len) { sum += ch[i] * raw[j]; w += raw[j] } }
						v = w !== 0 ? sum / w : 0
					}
					v = Math.abs(v)
					if (v > peak) peak = v
				}
			}
		}
	}
	return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}
