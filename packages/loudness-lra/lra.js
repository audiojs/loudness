// Loudness range (LRA) per EBU Tech 3342: short-term loudness (3 s window, 100 ms hop,
// K-weighted channel sum) → absolute gate −70 LUFS → relative gate −20 LU below the
// abs-gated mean → LRA = 95th − 10th percentile of the remaining distribution (LU).

import kWeighting from '@audio/weighting-k'

const OFFSET = -0.691, ABS_GATE = -70, REL_GATE = -20
const ST_WINDOW = 3, ST_HOP = 0.1

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, weights }
 * @returns {number|null} loudness range in LU, or null for silence / too-short input
 */
export default function lra (channels, { fs = 48000, weights } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let G = weights || channels.map(() => 1)
	let k = channels.map(ch => {
		let c = Float32Array.from(ch)
		kWeighting(c, { fs })
		return c
	})

	let win = Math.round(ST_WINDOW * fs)
	let hop = Math.round(ST_HOP * fs)
	let n = k[0].length
	if (n < win) return null

	let st = [] // short-term block powers
	for (let i = 0; i + win <= n; i += hop) {
		let sum = 0
		for (let c = 0; c < k.length; c++) {
			let z = 0, ch = k[c]
			for (let j = i; j < i + win; j++) z += ch[j] * ch[j]
			sum += G[c] * z / win
		}
		st.push(sum)
	}

	let absT = 10 ** ((ABS_GATE - OFFSET) / 10)
	let gated = st.filter(p => p > absT)
	if (!gated.length) return null
	let mean = gated.reduce((a, b) => a + b, 0) / gated.length
	let final = gated.filter(p => p > mean * 10 ** (REL_GATE / 10)).sort((a, b) => a - b)
	if (final.length < 2) return 0

	let q = (arr, p) => arr[Math.min(arr.length - 1, Math.round(p * (arr.length - 1)))]
	let lo = q(final, 0.10), hi = q(final, 0.95)
	return 10 * Math.log10(hi / lo)
}
