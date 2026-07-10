// stat manifest — true peak (dBTP, inter-sample; ITU-R BS.1770-4 Annex 2 oversampled detector).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import truepeakFn from './truepeak.js'

export const truepeak = {
	stat: 'truepeak',
	compute: (channels, { sampleRate, ...opts }) => truepeakFn(channels, { fs: sampleRate, ...opts }),
}
