// ReplayGain 2.0 — track gain relative to the −18 LUFS reference loudness
// (RG2 spec: gain = reference − measured integrated loudness, BS.1770-based),
// paired with the track peak the spec carries alongside it so that applying
// the gain can be made clip-safe.

import lufs from '@audio/loudness-lufs'

const REFERENCE = -18

/**
 * @param {Float32Array|Float32Array[]} channels
 * @param {object} opts — { fs=48000, weights }
 * @returns {{ gain: number, lufs: number, peak: number }|null} gain in dB to reach
 *   −18 LUFS, the measured loudness, and linear sample peak across all channels
 */
export default function replaygain (channels, opts = {}) {
	let measured = lufs(channels, opts)
	if (measured === null) return null

	if (channels[0]?.length === undefined) channels = [channels]

	// every channel counts, including any the loudness measurement excludes —
	// peak is about what clips on playback, not about weighted loudness
	let peak = 0
	for (let ch of channels) {
		for (let i = 0; i < ch.length; i++) {
			let m = ch[i] < 0 ? -ch[i] : ch[i]
			if (m > peak) peak = m
		}
	}

	return { gain: REFERENCE - measured, lufs: measured, peak }
}
