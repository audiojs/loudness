/** True peak (dBTP) — 4x sinc-oversampled inter-sample peak (BS.1770-4 Annex 2 methodology). */
export interface TruePeakOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** oversampling factor, default 4 */
  oversample?: number
}

/**
 * @param channels mono buffer or array of channel buffers
 * @returns true peak in dBTP, or -Infinity for silence
 */
export default function truepeak(channels: Float32Array | Float32Array[], options?: TruePeakOptions): number
