// stat manifest — sound labeling (level-threshold region detection; Audacity Label Sounds).
// Whole-signal analysis: the host reads the (ranged) PCM and calls compute once —
// the (channels, { fs }) batch shape the kernel already is.

import soundsFn from './sounds.js'

export const sounds = {
	stat: 'sounds',
	compute: (channels, { sampleRate, ...opts }) => soundsFn(channels, { fs: sampleRate, ...opts }),
}
