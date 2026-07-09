// stat manifest — ReplayGain 2.0 track gain (dB relative to −18 LUFS reference).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import replaygainFn from './replaygain.js'

export const replaygain = {
	stat: 'replaygain',
	compute: (channels, { sampleRate, ...opts }) => replaygainFn(channels, { fs: sampleRate, ...opts }),
}
