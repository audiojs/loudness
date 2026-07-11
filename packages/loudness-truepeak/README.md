# @audio/loudness-truepeak [![npm](https://img.shields.io/npm/v/@audio/loudness-truepeak)](https://www.npmjs.com/package/@audio/loudness-truepeak) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

True peak (dBTP) — 4× sinc-oversampled inter-sample peak (BS.1770-4 Annex 2 methodology)

```
npm install @audio/loudness-truepeak
```

```js
import truepeak from '@audio/loudness-truepeak'
```

True peak per ITU-R BS.1770-4 Annex 2 methodology: the sample-domain peak and a 4×-oversampled peak (windowed-sinc interpolation via `@audio/resample-sinc`, a generic sinc interpolator rather than the specific FIR in Annex 2) are both taken per channel, and the maximum across all of them is reported — catching inter-sample peaks that a sample-domain peak meter misses.

```js
truepeak(channels)                        // default 4× oversampling @ 48000 Hz
truepeak(channels, { oversample: 8 })     // finer oversampling
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `oversample` | `4` | Oversampling factor (BS.1770-4 Annex 2 specifies 4× minimum) |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel — the maximum peak across all channels is returned). Returns a `number` (true peak in dBTP), or `-Infinity` for silence.

**Use when:** checking a master against a dBTP ceiling (e.g. −1 dBTP delivery specs) before lossy encoding, where inter-sample overs would otherwise clip after decode.

Per ITU-R BS.1770-4 Annex 2 (true-peak oversampling methodology); differential-tested against libebur128 / ffmpeg `ebur128`.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
