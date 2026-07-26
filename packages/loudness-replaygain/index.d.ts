/** ReplayGain 2.0 — track gain to the -18 LUFS reference. */
export interface ReplayGainOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /**
   * per-channel gain array, BS.1770-4 Table 1. Defaults by channel count assuming
   * SMPTE/WAV/Web Audio order — 1/2ch all 1.0, 4ch `[1,1,1.41,1.41]` (L R Ls Rs),
   * 5ch `[1,1,1,1.41,1.41]` (L R C Ls Rs), 6ch `[1,1,1,0,1.41,1.41]` (L R C LFE Ls Rs,
   * LFE excluded). Other counts default to 1.0 per channel; pass explicitly for
   * layouts in a different order.
   */
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
