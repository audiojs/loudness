/** Loudness range (LRA) per EBU Tech 3342. */
export interface LraOptions {
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
 * @returns loudness range in LU; 0 if fewer than 2 blocks survive gating; null for silence / input shorter than the 3 s short-term window
 */
/**
 * BS.1770-4 Table 1 weights keyed by channel count, assuming SMPTE/WAV/Web Audio
 * channel order. Counts absent from this map fall back to 1.0 per channel. Exposed
 * so callers can inspect the defaults or derive their own from them.
 */
export const LAYOUTS: Record<number, number[]>

export default function lra(channels: Float32Array | Float32Array[], options?: LraOptions): number | null
