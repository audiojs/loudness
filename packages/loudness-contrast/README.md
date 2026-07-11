# @audio/loudness-contrast [![npm](https://img.shields.io/npm/v/@audio/loudness-contrast)](https://www.npmjs.com/package/@audio/loudness-contrast) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Speech contrast — foreground/background RMS difference, WCAG 2.0 SC 1.4.7 (Audacity Contrast)

```
npm install @audio/loudness-contrast
```

```js
import speechContrast from '@audio/loudness-contrast'
```

Power-averaged foreground/background RMS in dB, per the [Audacity Contrast analyzer](https://manual.audacityteam.org/man/contrast.html) — the reference tool for [WCAG 2.0 Success Criterion 1.4.7](https://www.w3.org/WAI/WCAG21/Understanding/low-or-no-background-audio.html) (Low or No Background Audio). Two modes:

- **Explicit** — pass `fg`/`bg` as `[at, duration]` second slices, mirroring Audacity's two-selection workflow.
- **Auto** — omit either slice and 10 ms frames are pooled into foreground/background by a dB `threshold` (an extension beyond Audacity, which always takes two manual selections). A slice given explicitly is excluded from the auto scan on the other side, so a selection never contaminates the opposite pool.

```js
speechContrast(channels, { fg: [0, 1], bg: [4, 1] })   // explicit: two 1 s slices
speechContrast(channels)                                // auto: threshold-pooled
```

| Param | Default | |
|---|---|---|
| `fs` | `48000` | Sample rate, Hz |
| `fg` | — | `[at, duration]` seconds — explicit foreground slice; omit for auto mode |
| `bg` | — | `[at, duration]` seconds — explicit background slice; omit for auto mode |
| `threshold` | `-30` | dB level splitting auto-mode frames into foreground/background |
| `frame` | `0.01` | Auto-mode classification frame, seconds (Audacity: 10 ms chunks) |

Accepts `Float32Array` (mono) or `Float32Array[]` (multichannel — RMS is power-averaged across channels before the dB conversion).

Returns `{ foreground, background, contrast, pass }` — `foreground`/`background` in dB, `contrast` = `foreground - background`, `pass` = `contrast >= 20` (the WCAG 2.0 SC 1.4.7 threshold).

**Use when:** validating that dialogue/narration is intelligible over background music or noise — captioning/accessibility pipelines, video QC.

Per WCAG 2.0 SC 1.4.7 / Audacity Contrast; ratio dB, not LUFS.

---

Part of [@audio/loudness](https://github.com/audiojs/loudness) — the loudness family umbrella. Documented from the reference implementation.

MIT © [audiojs](https://github.com/audiojs)
