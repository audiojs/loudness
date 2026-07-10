// stat manifest — speech contrast (dB; Audacity Contrast / WCAG 2.0 SC 1.4.7 pass at ≥20 dB).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import speechContrast from './contrast.js'

export const contrast = {
	stat: 'speech-contrast',
	compute: (channels, { sampleRate, ...opts }) => speechContrast(channels, { fs: sampleRate, ...opts }),
}
