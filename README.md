# @audio/loudness

> Loudness metering per ITU-R BS.1770-4 / EBU R128. LUFS, true peak, LRA, ReplayGain, DR, Contrast, and Label Sounds shipped.

Prerequisites shipped: K-weighting filter lives in `@audio/weighting-k` (exact BS.1770-4 at any sample rate). A BS.1770-4 LUFS reference implementation exists in the `audio` package (channel-sum + 400ms/75%-overlap gating) — extract, don't rewrite. Differential-test against libebur128 / ffmpeg `ebur128`. Bare npm `loudness` is owned by an unrelated maintainer — hence the scope.
