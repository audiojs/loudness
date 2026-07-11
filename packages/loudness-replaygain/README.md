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
replaygain(channels, { fs: 48000 })   // { gain, lufs }
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `weights` | `1.0` per channel | Per-channel gain array, BS.1770-4 Table 1 (pass `1.41` for Ls/Rs surrounds) |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel). Returns `{ gain, lufs }` — `gain` in dB to reach −18 LUFS, `lufs` the measured integrated loudness — or `null` for silence / fully-gated input (same conditions under which `loudness-lufs` returns `null`).

**Use when:** computing per-track/per-album normalization gain for players and tag writers targeting the RG2 −18 LUFS reference.

Per the ReplayGain 2.0 specification (BS.1770-based loudness, −18 LUFS reference), built on `@audio/loudness-lufs`.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
