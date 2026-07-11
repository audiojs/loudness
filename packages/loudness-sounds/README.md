# @audio/loudness-sounds [![npm](https://img.shields.io/npm/v/@audio/loudness-sounds)](https://www.npmjs.com/package/@audio/loudness-sounds) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Sound labeling — level-threshold region detection (Audacity Label Sounds)

```
npm install @audio/loudness-sounds
```

```js
import sounds from '@audio/loudness-sounds'
```

Region detector modeled on Audacity's [Label Sounds](https://manual.audacityteam.org/man/label_sounds.html) analyzer — not a loudness metric, but a level-threshold segmenter that ships in this family for the same input pipeline. 10 ms chunks are classed sound/silence against a level `threshold`, adjacent sound regions closer than `minSilence` are merged, regions shorter than `minSound` are folded into the next, and each surviving region is padded (`pre`/`post`) into its neighboring silence — never past a neighboring *sound* boundary, per the manual: "labels can overlap other labels, but cannot overlap previous or following sounds."

```js
sounds(channels, { threshold: -30, minSilence: 1, minSound: 1 })
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `threshold` | `-30` | dB level splitting sound from silence |
| `measurement` | `'peak'` | `'peak'` (max \|x\|, most sensitive — catches low-duty-cycle transients), `'avg'` (mean \|x\|), or `'rms'` (sqrt mean x²) |
| `minSilence` | `1` | Silence gaps shorter than this (seconds) are closed, merging the regions either side |
| `minSound` | `1` | Regions shorter than this (seconds) are folded into the following region |
| `pre` | `0` | Seconds to pad each region's start into leading silence |
| `post` | `0` | Seconds to pad each region's end into trailing silence |
| `max` | `10000` | Maximum number of regions returned |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel — chunk level is computed across all channels together). Returns an array of `{ at, duration, label }` (label = `'Sound N'`), ordered by position.

**Use when:** auto-splitting a long recording into per-take/per-phrase regions, silence trimming, or generating label tracks for editors.

Modeled on Audacity's Label Sounds analyzer; a level-threshold segmenter, not an ITU-R/EBU loudness measurement.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
