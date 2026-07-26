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

	// the 3 s window advances by 100 ms, so it spans exactly 30 hops: summing each
	// hop's power once and sharing it across the 30 windows covering it replaces
	// 30 passes over every sample with one
	let hop = Math.round(ST_HOP * fs)
	let per = Math.round(ST_WINDOW / ST_HOP)
	let win = hop * per
	let n = channels[0].length
	if (n < win) return null

	let hops = Math.floor(n / hop)
	let st = new Float64Array(hops - per + 1) // short-term block powers
	let power = new Float64Array(hops)

	// K-weight one hop at a time through a reused scratch buffer; filter state
	// persists on `params`, so this matches filtering the whole channel without
	// allocating a copy of it
	let scratch = new Float32Array(hop)

	for (let c = 0; c < channels.length; c++) {
		let ch = channels[c], params = { fs }

		for (let h = 0; h < hops; h++) {
			scratch.set(ch.subarray(h * hop, h * hop + hop))
			kWeighting(scratch, params)
			let z = 0
			for (let j = 0; j < hop; j++) z += scratch[j] * scratch[j]
			power[h] = z
		}

		for (let b = 0; b < st.length; b++) {
			let z = 0
			for (let p = 0; p < per; p++) z += power[b + p]
			st[b] += G[c] * z / win
		}
	}

	let absT = 10 ** ((ABS_GATE - OFFSET) / 10)
	let gated = [...st].filter(p => p > absT)
	if (!gated.length) return null
	let mean = gated.reduce((a, b) => a + b, 0) / gated.length
	let final = gated.filter(p => p > mean * 10 ** (REL_GATE / 10)).sort((a, b) => a - b)
	if (final.length < 2) return 0

	let q = (arr, p) => arr[Math.min(arr.length - 1, Math.round(p * (arr.length - 1)))]
	let lo = q(final, 0.10), hi = q(final, 0.95)
	return 10 * Math.log10(hi / lo)
}
