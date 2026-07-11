/** ReplayGain 2.0 — track gain to the -18 LUFS reference. */
export interface ReplayGainOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** per-channel gain array, BS.1770-4 Table 1 (default 1.0 per channel; pass 1.41 for Ls/Rs surrounds) */
  weights?: number[]
}

export interface ReplayGainResult {
  /** gain in dB to reach -18 LUFS */
  gain: number
  /** measured integrated loudness, LUFS */
  lufs: number
}

/**
 * @param channels mono buffer or array of channel buffers
 * @returns { gain, lufs }, or null for silence / fully-gated input
 */
export default function replaygain(channels: Float32Array | Float32Array[], options?: ReplayGainOptions): ReplayGainResult | null
