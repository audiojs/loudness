/** Speech contrast — Audacity Contrast analyzer / WCAG 2.0 SC 1.4.7. */
export interface SpeechContrastOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** [at, duration] seconds — explicit foreground slice; omit for auto (threshold-pooled) mode */
  fg?: [number, number]
  /** [at, duration] seconds — explicit background slice; omit for auto (threshold-pooled) mode */
  bg?: [number, number]
  /** dB level splitting auto-mode frames into foreground/background, default -30 */
  threshold?: number
  /** auto-mode classification frame, seconds, default 0.01 */
  frame?: number
}

export interface SpeechContrastResult {
  /** foreground RMS, dB */
  foreground: number
  /** background RMS, dB */
  background: number
  /** foreground - background, dB */
  contrast: number
  /** contrast >= 20 (WCAG 2.0 SC 1.4.7 threshold) */
  pass: boolean
}

export default function speechContrast(channels: Float32Array | Float32Array[], options?: SpeechContrastOptions): SpeechContrastResult
