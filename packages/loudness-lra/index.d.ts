/** Loudness range (LRA) per EBU Tech 3342. */
export interface LraOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** per-channel gain array, BS.1770-4 Table 1 (default 1.0 per channel; pass 1.41 for Ls/Rs surrounds) */
  weights?: number[]
}

/**
 * @param channels mono buffer or array of channel buffers
 * @returns loudness range in LU; 0 if fewer than 2 blocks survive gating; null for silence / input shorter than the 3 s short-term window
 */
export default function lra(channels: Float32Array | Float32Array[], options?: LraOptions): number | null
