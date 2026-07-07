// ReplayGain 2.0 — track gain relative to the −18 LUFS reference loudness
// (RG2 spec: gain = reference − measured integrated loudness, BS.1770-based).

import lufs from '@audio/loudness-lufs'

const REFERENCE = -18

/**
 * @param {Float32Array|Float32Array[]} channels
 * @param {object} opts — { fs=48000, weights }
 * @returns {{ gain: number, lufs: number }|null} gain in dB to reach −18 LUFS
 */
export default function replaygain (channels, opts = {}) {
	let measured = lufs(channels, opts)
	if (measured === null) return null
	return { gain: REFERENCE - measured, lufs: measured }
}
