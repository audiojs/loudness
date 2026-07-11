/** Sound labeling — level-threshold region detection (Audacity Label Sounds). */
export interface SoundsOptions {
  /** sample rate, Hz, default 48000 */
  fs?: number
  /** dB level splitting sound from silence, default -30 */
  threshold?: number
  /** level measurement: 'peak' (max |x|, default), 'avg' (mean |x|), or 'rms' (sqrt mean x^2) */
  measurement?: 'peak' | 'avg' | 'rms'
  /** silence gaps shorter than this (seconds) are closed, merging regions either side, default 1 */
  minSilence?: number
  /** regions shorter than this (seconds) are folded into the following region, default 1 */
  minSound?: number
  /** seconds to pad each region's start into leading silence, default 0 */
  pre?: number
  /** seconds to pad each region's end into trailing silence, default 0 */
  post?: number
  /** maximum number of regions returned, default 10000 */
  max?: number
}

export interface SoundRegion {
  /** region start, seconds */
  at: number
  /** region length, seconds */
  duration: number
  /** e.g. 'Sound 1' */
  label: string
}

export default function sounds(channels: Float32Array | Float32Array[], options?: SoundsOptions): SoundRegion[]
