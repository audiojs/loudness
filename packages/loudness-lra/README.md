# @audio/loudness-lra [![npm](https://img.shields.io/npm/v/@audio/loudness-lra)](https://www.npmjs.com/package/@audio/loudness-lra) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Loudness range (LRA) — EBU Tech 3342 short-term distribution, P95−P10 after gating

```
npm install @audio/loudness-lra
```

```js
import lra from '@audio/loudness-lra'
```

Loudness range per [EBU Tech 3342](https://tech.ebu.ch/publications/tech3342): K-weighted (via `@audio/weighting-k`) channel-summed short-term loudness on a 3 s window at 100 ms hop → absolute gate at −70 LUFS → relative gate at −20 LU below the abs-gated mean → `LRA = P95 − P10` of the remaining distribution, in LU.

```js
let range = lra(channels, { fs: 48000 })   // channels: Float32Array (mono) or Float32Array[] (multichannel)
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `weights` | `1.0` per channel | Per-channel gain array, BS.1770-4 Table 1 (pass `1.41` for Ls/Rs surrounds) |

Returns a `number` (LRA in LU), `0` if fewer than 2 blocks survive gating, or `null` for silence / input shorter than the 3 s short-term window.

**Use when:** measuring program dynamics for broadcast delivery specs (EBU R128 / ATSC A/85) that cap LRA alongside integrated loudness.

Per ITU-R BS.1770-4 (K-weighting, gating) and EBU Tech 3342 (short-term window, percentile range); differential-tested against libebur128 / ffmpeg `ebur128`.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
