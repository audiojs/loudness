// stat manifest — speech contrast (dB; Audacity Contrast / WCAG 2.0 SC 1.4.7 pass at ≥20 dB).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import speechContrastFn from './contrast.js'

// named speechContrast (not `contrast`) — the spectral-contrast manifest already exports that identifier
export const speechContrast = {
	stat: 'speech-contrast',
	compute: (channels, { sampleRate, ...opts }) => speechContrastFn(channels, { fs: sampleRate, ...opts }),
}
