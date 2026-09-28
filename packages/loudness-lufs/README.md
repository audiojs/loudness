# @audio/loudness-lufs

> Integrated loudness (LUFS) per ITU-R BS.1770-4: K-weighting → 400 ms gating blocks at 75% overlap → absolute gate (-70 LUFS) → relative gate (-10 LU below the abs-gated mean). Verified against EBU Tech 3341 minimum-requirements test vectors.

`npm install @audio/loudness-lufs`

```js
import lufs from '@audio/loudness-lufs'

let l = lufs(channels, { fs: 48000 })   // channels: Float32Array (mono) or Float32Array[] (multichannel)
// number (LUFS), or null for silence / fully-gated input
```

Options: - `fs` — sample rate (default 48000, Hz — note this differs from the 44100 default used across `@audio/spectral`) · `weights` — per-channel gain array, BS.1770-4 Table 3, defaulting by channel count assuming SMPTE/WAV/Web Audio order (1/2ch all 1.0, 4ch `[1,1,1.41,1.41]`, 5ch `[1,1,1,1.41,1.41]`, 6ch `[1,1,1,0,1.41,1.41]` with LFE excluded, 8ch `[1,1,1,0,1,1,1.41,1.41]` for 7.1 per Table 4; other counts 1.0 per channel)

Part of [@audio/loudness](https://github.com/audiojs/loudness).
