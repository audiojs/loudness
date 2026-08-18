# @audio/loudness

> Loudness metering per ITU-R BS.1770-4 / EBU R128 — umbrella re-exporting every `@audio/loudness-*` atom.

```js
import { lufs, truepeak, lra, replaygain, dr, speechContrast, sounds } from '@audio/loudness'

lufs(channels, { fs: 48000 })        // integrated LUFS
replaygain(channels, { fs: 48000 })  // { gain, lufs, peak }
```

Each atom ships standalone:

| Atom | Measures |
|---|---|
| [`@audio/loudness-lufs`](https://www.npmjs.com/package/@audio/loudness-lufs) | Integrated loudness (LUFS) — BS.1770-4 K-weighted gated, EBU Tech 3341-verified |
| [`@audio/loudness-truepeak`](https://www.npmjs.com/package/@audio/loudness-truepeak) | True peak (dBTP) — 4× sinc-oversampled inter-sample peak, BS.1770-4 Annex 2 |
| [`@audio/loudness-lra`](https://www.npmjs.com/package/@audio/loudness-lra) | Loudness range (LRA) — EBU Tech 3342 short-term distribution, P95−P10 after gating |
| [`@audio/loudness-replaygain`](https://www.npmjs.com/package/@audio/loudness-replaygain) | ReplayGain 2.0 — track gain to the −18 LUFS reference + sample peak |
| [`@audio/loudness-dr`](https://www.npmjs.com/package/@audio/loudness-dr) | DR value — TT/dr14 crest-factor dynamic range |
| [`@audio/loudness-contrast`](https://www.npmjs.com/package/@audio/loudness-contrast) | Speech contrast — foreground/background RMS difference, WCAG 2.0 SC 1.4.7 |
| [`@audio/loudness-sounds`](https://www.npmjs.com/package/@audio/loudness-sounds) | Sound labeling — level-threshold region detection (Audacity Label Sounds) |

Multichannel weights default to BS.1770-4 Table 1 by channel count (SMPTE/WAV/Web Audio order, LFE excluded). K-weighting lives in [`@audio/weighting-k`](https://www.npmjs.com/package/@audio/weighting-k) — exact BS.1770-4 at any sample rate.

Bare npm `loudness` is an unrelated package — hence the scope.
