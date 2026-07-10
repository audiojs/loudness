// Speech contrast — Audacity "Contrast" analyzer / WCAG 2.0 SC 1.4.7:
// foreground/background RMS in dB (power-averaged across channels), pass at ≥20 dB difference.
// Explicit mode measures given [at, duration] slices (Audacity's two-selection workflow); auto
// mode pools the remaining 10 ms frames by a dB threshold — an extension beyond Audacity.
// https://manual.audacityteam.org/man/contrast.html

/**
 * @param {Float32Array|Float32Array[]} channels
 * @param {object} opts — { fs=48000, fg, bg, threshold=-30, frame=0.01 }
 *   fg/bg: [at, duration] seconds — explicit slices; omit either for auto (threshold-pooled) mode
 * @returns {{foreground:number, background:number, contrast:number, pass:boolean}}
 */
export default function speechContrast (channels, { fs = 48000, fg, bg, threshold = -30, frame = 0.01 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let n = channels[0]?.length || 0

	let foreground = fg && sliceDb(channels, Math.round(fg[0] * fs), Math.round((fg[0] + fg[1]) * fs))
	let background = bg && sliceDb(channels, Math.round(bg[0] * fs), Math.round((bg[0] + bg[1]) * fs))

	// auto mode: classify 10 ms frames into fg/bg pools by threshold, only for the side not
	// given explicitly (an extension — Audacity itself takes two manual selections, no auto).
	// Explicitly-claimed slices are excluded from the scan so a selection never leaks into
	// the other side's pool.
	if (foreground === undefined || background === undefined) {
		let frameLen = Math.max(1, Math.round(frame * fs))
		let xs = fg ? Math.round(fg[0] * fs) : 0, xe = fg ? Math.round((fg[0] + fg[1]) * fs) : 0
		let ys = bg ? Math.round(bg[0] * fs) : 0, ye = bg ? Math.round((bg[0] + bg[1]) * fs) : 0
		let fgSum = 0, fgCount = 0, bgSum = 0, bgCount = 0
		for (let i = 0; i < n; i += frameLen) {
			let e = Math.min(i + frameLen, n)
			if ((i < xe && e > xs) || (i < ye && e > ys)) continue
			let sum = 0, count = 0
			for (let c = 0; c < channels.length; c++) {
				let ch = channels[c]
				for (let j = i; j < e; j++) sum += ch[j] * ch[j]
				count += e - i
			}
			let db = count ? 10 * Math.log10(sum / count) : -Infinity
			if (db >= threshold) { fgSum += sum; fgCount += count }
			else { bgSum += sum; bgCount += count }
		}
		if (foreground === undefined) foreground = fgCount ? 10 * Math.log10(fgSum / fgCount) : -Infinity
		if (background === undefined) background = bgCount ? 10 * Math.log10(bgSum / bgCount) : -Infinity
	}

	let contrast = foreground - background
	return { foreground, background, contrast, pass: contrast >= 20 }
}

// power-averaged RMS (dB) of [start, end) across all channels — -Infinity for an empty slice
function sliceDb (channels, start, end) {
	let sum = 0, count = 0
	for (let c = 0; c < channels.length; c++) {
		let ch = channels[c]
		let s = Math.max(0, start), e = Math.min(ch.length, end)
		for (let i = s; i < e; i++) sum += ch[i] * ch[i]
		count += Math.max(0, e - s)
	}
	return count ? 10 * Math.log10(sum / count) : -Infinity
}
