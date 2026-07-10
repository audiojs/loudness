# @audio/loudness-lufs

> Integrated loudness (LUFS) per ITU-R BS.1770-4: K-weighting → 400 ms gating blocks at 75% overlap → absolute gate (-70 LUFS) → relative gate (-10 LU below the abs-gated mean). Verified against EBU Tech 3341 minimum-requirements test vectors.

`npm install @audio/loudness-lufs`

```js
import lufs from '@audio/loudness-lufs'

let l = lufs(channels, { fs: 48000 })   // channels: Float32Array (mono) or Float32Array[] (multichannel)
// number (LUFS), or null for silence / fully-gated input
```

Options: - `fs` — sample rate (default 48000, Hz — note this differs from the 44100 default used across `@audio/spectral`) · `weights` — per-channel gain array, BS.1770-4 Table 1 (default 1.0 per channel; pass 1.41 for Ls/Rs surrounds)

Part of [@audio/loudness](https://github.com/audiojs/loudness).
