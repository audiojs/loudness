// Integrated loudness (LUFS) per ITU-R BS.1770-4:
// K-weighting → 400 ms gating blocks at 75% overlap → absolute gate (−70 LUFS) →
// relative gate (−10 LU below the abs-gated mean) → L = −0.691 + 10·log10(Σ_c G_c·z̄_c).
// Verified against EBU Tech 3341 minimum-requirements test vectors.

import kWeighting from '@audio/weighting-k'

const OFFSET = -0.691, ABS_GATE = -70, REL_GATE = -10
const GATE_WINDOW = 0.4, GATE_HOP = 0.1

// BS.1770-4 Table 1 weights per channel count, assuming the SMPTE/WAV/Web Audio
// ordering these layouts overwhelmingly arrive in. Surrounds count 1.41; LFE is
// excluded from the measurement. Counts not listed fall back to 1.0 per channel
// — pass `weights` explicitly for layouts in a different order.
export const LAYOUTS = {
	1: [1], // mono
	2: [1, 1], // L R
	4: [1, 1, 1.41, 1.41], // L R Ls Rs
	5: [1, 1, 1, 1.41, 1.41], // L R C Ls Rs
	6: [1, 1, 1, 0, 1.41, 1.41], // L R C LFE Ls Rs
}

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or array of channel buffers
 * @param {object} opts — { fs, weights } — weights default to BS.1770-4 Table 1
 *   for known channel counts (see LAYOUTS), 1.0 per channel otherwise
 * @returns {number|null} integrated LUFS, or null for silence / all-gated input
 */
export default function lufs (channels, { fs = 48000, weights } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let G = weights || LAYOUTS[channels.length] || channels.map(() => 1)

	// 75% overlap means the window is exactly 4 hops, so each hop's power can be
	// summed once and shared by the 4 blocks covering it, rather than re-summing
	// every sample 4 times. Deriving win from hop also keeps the overlap exactly
	// 75% at rates where round(0.4·fs) ≠ 4·round(0.1·fs).
	let hop = Math.round(GATE_HOP * fs)
	let per = Math.round(GATE_WINDOW / GATE_HOP)
	let win = hop * per
	let n = channels[0].length
	if (n < win) return null

	let hops = Math.floor(n / hop)
	let blocks = new Float64Array(hops - per + 1)
	let power = new Float64Array(hops)

	// K-weight one hop at a time through a reused scratch buffer. Filter state
	// persists on `params` across calls, so the result is identical to filtering
	// the whole channel — without allocating a copy of it.
	let scratch = new Float32Array(hop)

	for (let c = 0; c < channels.length; c++) {
		if (!G[c]) continue // excluded channel (LFE) — no need to filter it
		let ch = channels[c], params = { fs }

		for (let h = 0; h < hops; h++) {
			scratch.set(ch.subarray(h * hop, h * hop + hop))
			kWeighting(scratch, params)
			let z = 0
			for (let j = 0; j < hop; j++) z += scratch[j] * scratch[j]
			power[h] = z
		}

		// per-block power: Σ_c G_c · mean-square over the 400 ms window
		for (let b = 0; b < blocks.length; b++) {
			let z = 0
			for (let p = 0; p < per; p++) z += power[b + p]
			blocks[b] += G[c] * z / win
		}
	}

	let absT = 10 ** ((ABS_GATE - OFFSET) / 10)
	let sum = 0, count = 0
	for (let p of blocks) if (p > absT) { sum += p; count++ }
	if (!count) return null

	let relT = (sum / count) * 10 ** (REL_GATE / 10)
	sum = 0; count = 0
	for (let p of blocks) if (p > absT && p > relT) { sum += p; count++ }
	if (!count) return null

	return OFFSET + 10 * Math.log10(sum / count)
}
