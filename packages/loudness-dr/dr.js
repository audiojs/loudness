// DR value — crest-factor dynamic range meter (TT/dr14 method):
// per-channel 3 s blocks → block RMS with the ×2 sine convention (full-scale sine → 0 dB)
// and block peak; DR_ch = 20·log10(secondHighestPeak / rms of loudest 20% blocks); average channels.

/**
 * @param {Float32Array|Float32Array[]} channels
 * @param {object} opts — { fs=48000, blockSeconds=3 }
 * @returns {number|null} DR value in dB
 */
export default function dr (channels, { fs = 48000, blockSeconds = 3 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let win = Math.round(blockSeconds * fs)
	let drs = []

	for (let ch of channels) {
		if (ch.length < win * 2) win = Math.max(1, Math.floor(ch.length / 2))
		let rms = [], peaks = []
		for (let i = 0; i + win <= ch.length; i += win) {
			let e = 0, p = 0
			for (let j = i; j < i + win; j++) {
				let v = ch[j]
				e += v * v
				let a = Math.abs(v)
				if (a > p) p = a
			}
			rms.push(Math.sqrt(2 * e / win))
			peaks.push(p)
		}
		if (rms.length < 2) continue
		peaks.sort((a, b) => b - a)
		rms.sort((a, b) => b - a)
		let top = Math.max(1, Math.round(rms.length * 0.2))
		let e20 = 0
		for (let i = 0; i < top; i++) e20 += rms[i] * rms[i]
		let r = Math.sqrt(e20 / top)
		let p2 = peaks[1]
		if (r > 0 && p2 > 0) drs.push(20 * Math.log10(p2 / r))
	}
	return drs.length ? drs.reduce((a, b) => a + b, 0) / drs.length : null
}
