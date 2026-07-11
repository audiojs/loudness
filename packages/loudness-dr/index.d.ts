/** DR value — TT/DR14 crest-factor dynamic range meter (Pleasurize Music Foundation). */
export interface DrOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** analysis block length, seconds, default 3 */
  blockSeconds?: number
}

/**
 * @param channels mono buffer or array of channel buffers
 * @returns DR value in dB, averaged across channels, or null if no channel yields at least 2 blocks
 */
export default function dr(channels: Float32Array | Float32Array[], options?: DrOptions): number | null
