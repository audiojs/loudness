/** Integrated loudness (LUFS) per ITU-R BS.1770-4. */
export interface LufsOptions {
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

/**
 * @param channels mono buffer or array of channel buffers
 * @returns integrated LUFS, or null for silence / fully-gated input
 */
/**
 * BS.1770-4 Table 1 weights keyed by channel count, assuming SMPTE/WAV/Web Audio
 * channel order. Counts absent from this map fall back to 1.0 per channel. Exposed
 * so callers can inspect the defaults or derive their own from them.
 */
export const LAYOUTS: Readonly<Record<number, readonly number[]>>

export default function lufs(channels: Float32Array | Float32Array[], options?: LufsOptions): number | null
