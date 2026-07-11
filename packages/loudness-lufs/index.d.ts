/** Integrated loudness (LUFS) per ITU-R BS.1770-4. */
export interface LufsOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** per-channel gain array, BS.1770-4 Table 1 (default 1.0 per channel; pass 1.41 for Ls/Rs surrounds) */
  weights?: number[]
}

/**
 * @param channels mono buffer or array of channel buffers
 * @returns integrated LUFS, or null for silence / fully-gated input
 */
export default function lufs(channels: Float32Array | Float32Array[], options?: LufsOptions): number | null
