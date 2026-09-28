# @audio/loudness-truepeak [![npm](https://img.shields.io/npm/v/@audio/loudness-truepeak)](https://www.npmjs.com/package/@audio/loudness-truepeak) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

True peak (dBTP) — 4× sinc-oversampled inter-sample peak (BS.1770-5 Annex 2 methodology)

```
npm install @audio/loudness-truepeak
```

```js
import truepeak from '@audio/loudness-truepeak'
```

True peak per ITU-R BS.1770-5 Annex 2 (oversample, rectify, take the maximum) and its recommends 5 ("or a method that gives similar or superior results"): per channel, the samples and the points between them, 4 a sample by default, read polyphase through a 96-tap Kaiser-windowed sinc (β 8) with silence outside the signal; each local maximum of the points is refined by the parabola through it and its neighbours, which finds the peak between them. The maximum across all channels is reported. Against the waveform read 32× through a Kaiser-windowed sinc (β 14, 128 taps a phase), speech, white noise, noise clipped 18 dB, limited speech and EBU Tech 3341 cases 15-23 read within 0.01 dB at 8 to 48 kHz; the 32-tap Lanczos kernel before it, reading its points alone, read clipped or limited material up to 0.4 dB low.

```js
truepeak(channels)                        // default 4× oversampling @ 48000 Hz
truepeak(channels, { oversample: 8 })     // finer oversampling
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `oversample` | `4` | Points a sample (BS.1770-5 Annex 2: 4 at 48 kHz); a fraction rounds up |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel — the maximum peak across all channels is returned). Returns a `number` (true peak in dBTP), or `-Infinity` for silence.

**Use when:** checking a master against a dBTP ceiling (e.g. −1 dBTP delivery specs) before lossy encoding, where inter-sample overs would otherwise clip after decode.

Per ITU-R BS.1770-5 Annex 2; tested against EBU Tech 3341 cases 15-23 and a 32× band-limited reference; libebur128 1.2.6 reads the same noise 0.08-0.84 dB lower.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
