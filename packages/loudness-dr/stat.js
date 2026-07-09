// stat manifest — dynamic range (TT DR method — crest-factor class score).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import drFn from './dr.js'

export const dr = {
	stat: 'dr',
	compute: (channels, { sampleRate, ...opts }) => drFn(channels, { fs: sampleRate, ...opts }),
}
