// Integrated loudness (LUFS) per ITU-R BS.1770-4:
// K-weighting → 400 ms gating blocks at 75% overlap → absolute gate (−70 LUFS) →
// relative gate (−10 LU below the abs-gated mean) → L = −0.691 + 10·log10(Σ_c G_c·z̄_c).
// Verified against EBU Tech 3341 minimum-requirements test vectors.

import kWeighting from '@audio/weighting-k'

const OFFSET = -0.691, ABS_GATE = -70, REL_GATE = -10
const GATE_WINDOW = 0.4, GATE_HOP = 0.1

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or array of channel buffers
 * @param {object} opts — { fs, weights } — weights default 1.0 per channel
 *   (BS.1770-4 Table 1: pass 1.41 for Ls/Rs surrounds)
 * @returns {number|null} integrated LUFS, or null for silence / all-gated input
 */
export default function lufs (channels, { fs = 48000, weights } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let G = weights || channels.map(() => 1)

	// K-weighted copies
	let k = channels.map(ch => {
		let c = Float32Array.from(ch)
		kWeighting(c, { fs })
		return c
	})

	let win = Math.round(GATE_WINDOW * fs)
	let hop = Math.round(GATE_HOP * fs)
	let n = k[0].length
	if (n < win) return null

	// per-block power: Σ_c G_c · mean-square over the 400 ms window
	let blocks = []
	for (let i = 0; i + win <= n; i += hop) {
		let sum = 0
		for (let c = 0; c < k.length; c++) {
			let z = 0, ch = k[c]
			for (let j = i; j < i + win; j++) z += ch[j] * ch[j]
			sum += G[c] * z / win
		}
		blocks.push(sum)
	}

	let absT = 10 ** ((ABS_GATE - OFFSET) / 10)
	let gated = blocks.filter(p => p > absT)
	if (!gated.length) return null

	let mean = gated.reduce((a, b) => a + b, 0) / gated.length
	let relT = mean * 10 ** (REL_GATE / 10)
	let final = gated.filter(p => p > relT)
	if (!final.length) return null

	return OFFSET + 10 * Math.log10(final.reduce((a, b) => a + b, 0) / final.length)
}
