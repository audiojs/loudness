// Loudness range (LRA) per EBU Tech 3342: short-term loudness (3 s window, 100 ms hop,
// K-weighted channel sum) → absolute gate −70 LUFS → relative gate −20 LU below the
// abs-gated mean → LRA = 95th − 10th percentile of the remaining distribution (LU).

import kWeighting from '@audio/weighting-k'
import { state, step } from '@audio/biquad'

const OFFSET = -0.691, ABS_GATE = -70, REL_GATE = -20
const ST_WINDOW = 3, ST_HOP = 0.1

// BS.1770-4 Table 3 weights per channel count, assuming the SMPTE/WAV/Web Audio
// ordering these layouts overwhelmingly arrive in. Surrounds count 1.41; LFE is
// excluded from the measurement; 7.1 per Table 4: sides (60° ≤ |θ| ≤ 120°) 1.41,
// backs (|θ| > 120°) 1.0. Counts not listed fall back to 1.0 per channel
// — pass `weights` explicitly for layouts in a different order.
export const LAYOUTS = Object.freeze({
	1: Object.freeze([1]), // mono
	2: Object.freeze([1, 1]), // L R
	4: Object.freeze([1, 1, 1.41, 1.41]), // L R Ls Rs
	5: Object.freeze([1, 1, 1, 1.41, 1.41]), // L R C Ls Rs
	6: Object.freeze([1, 1, 1, 0, 1.41, 1.41]), // L R C LFE Ls Rs
	8: Object.freeze([1, 1, 1, 0, 1, 1, 1.41, 1.41]), // L R C LFE Lb Rb Ls Rs
})

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, weights } — weights default to BS.1770-4
 *   Table 3 for known channel counts (see LAYOUTS), 1.0 per channel otherwise
 * @returns {number|null} loudness range in LU, or null for silence / too-short input
 */
export default function lra (channels, { fs = 48000, weights } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let G = weights || LAYOUTS[channels.length] || channels.map(() => 1)

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

	// Both K-weighting sections and the power accumulation run per sample, straight
	// off the source channel: one traversal instead of a copy, one pass per biquad
	// section, and a pass to square. Intermediates stay float64 rather than being
	// rounded back into a Float32Array between sections.
	let [shelf, rlb] = kWeighting.coefs(fs)

	for (let c = 0; c < channels.length; c++) {
		if (!G[c]) continue // excluded channel (LFE) — no need to filter it
		let ch = channels[c], s1 = state(), s2 = state()

		for (let h = 0, i = 0; h < hops; h++) {
			let z = 0
			for (let e = i + hop; i < e; i++) {
				let y = step(rlb, s2, step(shelf, s1, ch[i]))
				z += y * y
			}
			power[h] = z
		}

		for (let b = 0; b < st.length; b++) {
			let z = 0
			for (let p = 0; p < per; p++) z += power[b + p]
			st[b] += G[c] * z / win
		}
	}

	// gates as Tech 3342 §5's MATLAB reference: levels at or above each threshold stay
	let absT = 10 ** ((ABS_GATE - OFFSET) / 10)
	let gated = [...st].filter(p => p >= absT)
	if (!gated.length) return null
	let mean = gated.reduce((a, b) => a + b, 0) / gated.length
	let final = gated.filter(p => p >= mean * 10 ** (REL_GATE / 10)).sort((a, b) => a - b)
	if (final.length < 2) return 0

	let q = (arr, p) => arr[Math.min(arr.length - 1, Math.round(p * (arr.length - 1)))]
	let lo = q(final, 0.10), hi = q(final, 0.95)
	return 10 * Math.log10(hi / lo)
}
