# @audio/loudness-replaygain [![npm](https://img.shields.io/npm/v/@audio/loudness-replaygain)](https://www.npmjs.com/package/@audio/loudness-replaygain) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

ReplayGain 2.0 — track gain to the −18 LUFS reference

```
npm install @audio/loudness-replaygain
```

```js
import replaygain from '@audio/loudness-replaygain'
```

Track gain per [ReplayGain 2.0](https://wiki.hydrogenaud.io/index.php?title=ReplayGain_2.0_specification), which adopted BS.1770 integrated loudness as its measurement basis: `gain = -18 LUFS − measured`. Delegates the loudness measurement to `@audio/loudness-lufs` (ITU-R BS.1770-4 K-weighted gated loudness) and subtracts from the −18 LUFS RG2 reference.

```js
replaygain(channels, { fs: 48000 })   // { gain, lufs, peak }
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `weights` | BS.1770-4 Table 3 | Per-channel gain array. Defaults by channel count assuming SMPTE/WAV/Web Audio order: 1/2ch all `1.0`, 4ch `[1,1,1.41,1.41]`, 5ch `[1,1,1,1.41,1.41]`, 6ch `[1,1,1,0,1.41,1.41]` (LFE excluded), 8ch `[1,1,1,0,1,1,1.41,1.41]` (7.1, Table 4). Other counts default to `1.0` per channel — pass explicitly for layouts in a different order |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel). Returns `{ gain, lufs, peak }` — `gain` in dB to reach −18 LUFS, `lufs` the measured integrated loudness, `peak` the linear sample peak — or `null` for silence / fully-gated input (same conditions under which `loudness-lufs` returns `null`).

`peak` is the maximum absolute sample across every channel, including any the loudness measurement excludes (LFE), since it describes what clips on playback rather than weighted loudness. It is `0..1` for unclipped material and can exceed `1` for sources that overshoot. RG2 tags carry sample peak, which is what this is; for 4x-oversampled dBTP use [`@audio/loudness-truepeak`](https://www.npmjs.com/package/@audio/loudness-truepeak).

The pair is what makes the gain safe to apply: a player raising a track by `gain` dB should clamp so that `peak` stays below full scale.

**Use when:** computing per-track/per-album normalization gain for players and tag writers targeting the RG2 −18 LUFS reference — `gain` and `peak` map directly onto the `REPLAYGAIN_TRACK_GAIN` / `REPLAYGAIN_TRACK_PEAK` tag pair.

Per the ReplayGain 2.0 specification (BS.1770-based loudness, −18 LUFS reference), built on `@audio/loudness-lufs`.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
