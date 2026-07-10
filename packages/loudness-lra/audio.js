// stat manifest — loudness range (LU; EBU Tech 3342 gated distribution spread).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import lraFn from './lra.js'

export const lra = {
	stat: 'lra',
	compute: (channels, { sampleRate, ...opts }) => lraFn(channels, { fs: sampleRate, ...opts }),
}
