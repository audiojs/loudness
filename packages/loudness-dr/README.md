# @audio/loudness-dr [![npm](https://img.shields.io/npm/v/@audio/loudness-dr)](https://www.npmjs.com/package/@audio/loudness-dr) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

DR value — TT/dr14 crest-factor dynamic range meter

```
npm install @audio/loudness-dr
```

```js
import dr from '@audio/loudness-dr'
```

DR value per the TT ("Foobar2000 Dynamic Range Meter") / DR14 method used by the Pleasurize Music Foundation — **not** an EBU/BS.1770 measure, despite living in this loudness family. Per channel: split into 3 s blocks, compute block RMS with the ×2 sine convention (a full-scale sine reads 0 dB) and block peak; `DR_ch = 20·log10(secondHighestPeak / rms-of-loudest-20%-blocks)`. The final value is the average across channels.

```js
dr(channels)                        // default 3 s blocks @ 48000 Hz
dr(channels, { blockSeconds: 1 })   // shorter blocks for brief material
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `blockSeconds` | `3` | Analysis block length, seconds |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel — DR is computed per channel and averaged). Returns a `number` (DR value in dB), or `null` if no channel yields at least 2 blocks.

**Use when:** mastering QC — flag over-compressed/over-limited masters (the "loudness war" DR14 badge popularized by the Pleasurize Music Foundation and the foobar2000/TT meter).

Per the TT/DR14 dynamic range meter specification (Pleasurize Music Foundation), not EBU Tech 3342 — see `@audio/loudness-lra` for the EBU loudness-range measure.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
