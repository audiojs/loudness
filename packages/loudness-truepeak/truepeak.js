// True peak (dBTP) — inter-sample peak via 4× windowed-sinc oversampling,
// per ITU-R BS.1770-4 Annex 2 methodology (generic sinc interpolator).

import resample from '@audio/resample-sinc'

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, oversample=4 }
 * @returns {number} true peak in dBTP (−Infinity for silence)
 */
export default function truepeak (channels, { fs = 48000, oversample = 4 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let peak = 0
	for (let ch of channels) {
		for (let i = 0; i < ch.length; i++) { let a = Math.abs(ch[i]); if (a > peak) peak = a }
		let up = resample(ch, { from: fs, to: fs * oversample })
		for (let i = 0; i < up.length; i++) { let a = Math.abs(up[i]); if (a > peak) peak = a }
	}
	return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}
