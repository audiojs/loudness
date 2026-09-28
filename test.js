import test, { almost, ok, is } from 'tst'
import { lufs, truepeak, lra, replaygain, dr, speechContrast, sounds } from './index.js'

const fs = 48000

// EBU Tech 3341 sine: level in dBFS where a full-scale sine peaks at 1.0
function sine997 (dbfs, seconds, sr = fs) {
	let a = 10 ** (dbfs / 20)
	let d = new Float32Array(Math.round(seconds * sr))
	for (let i = 0; i < d.length; i++) d[i] = a * Math.sin(2 * Math.PI * 997 * i / sr)
	return d
}

// amplitude-driven 997 Hz sine (RMS = amp/√2) — for tests that need an exact known RMS level
function sineAmp (amp, seconds, sr = fs) {
	let d = new Float32Array(Math.round(seconds * sr))
	for (let i = 0; i < d.length; i++) d[i] = amp * Math.sin(2 * Math.PI * 997 * i / sr)
	return d
}

// ── EBU conformance ─────────────────────────────────────────────────────────
// EBU Tech 3341 and Tech 3342 (V4, November 2023), Table 1 "Minimum requirements test signals", generated as the tables
// define them: a 1000 Hz sine at a per-channel peak level in dBFS, in phase on both channels, 48 kHz; "tones similar to
// #1" follow each other on one running phase. Momentary and short-term loudness (cases 1, 2, 9-14) are audio's meters;
// this family measures integrated loudness, loudness range and true peak.

/** Segments [seconds, dBFS] of a 1000 Hz sine, `nch` identical channels. */
function tones (segs, { sr = fs, nch = 2 } = {}) {
	let n = segs.reduce((n, [s]) => n + Math.round(s * sr), 0), x = new Float32Array(n), i = 0
	for (let [s, db] of segs) for (let e = i + Math.round(s * sr), a = 10 ** (db / 20); i < e; i++) x[i] = a * Math.sin(2 * Math.PI * 1000 * i / sr)
	return Array.from({ length: nch }, () => x.slice())
}

test('EBU Tech 3341 cases 1-6: integrated loudness −23.0 ±0.1 LUFS (case 2: −33.0)', () => {
	almost(lufs(tones([[20, -23]]), { fs }), -23, 0.1, 'case 1: 20 s at −23 dBFS')
	almost(lufs(tones([[20, -33]]), { fs }), -33, 0.1, 'case 2: 20 s at −33 dBFS')
	almost(lufs(tones([[10, -36], [60, -23], [10, -36]]), { fs }), -23, 0.1, 'case 3: 10 s −36, 60 s −23, 10 s −36')
	almost(lufs(tones([[10, -72], [10, -36], [60, -23], [10, -36], [10, -72]]), { fs }), -23, 0.1, 'case 4: −72 and −36 gated out')
	almost(lufs(tones([[20, -26], [20.1, -20], [20, -26]]), { fs }), -23, 0.1, 'case 5: 20 s −26, 20.1 s −20, 20 s −26')
	let [l] = tones([[20, -28]], { nch: 1 }), [c] = tones([[20, -24]], { nch: 1 }), [s] = tones([[20, -30]], { nch: 1 })
	almost(lufs([l, l.slice(), c, s, s.slice()], { fs }), -23, 0.1, 'case 6: 5.0, L R −28, C −24, Ls Rs −30 dBFS')
})

// BS.1770-4 Annex 1: coefficients "for other sampling rates ... should provide the same frequency response"
test('EBU Tech 3341 case 1 at 8-192 kHz: −23.0 ±0.1 LUFS, K-weighting redesigned per rate', () => {
	for (let sr of [8000, 16000, 22050, 32000, 44100, 88200, 96000, 192000]) almost(lufs(tones([[20, -23]], { sr }), { fs: sr }), -23, 0.1, `${sr} Hz`)
})

test('mono is 3.01 LU below the same stereo signal (channel sum, BS.1770-4 eq. 2)', () => {
	let [ch] = tones([[10, -23]], { nch: 1 })
	almost(lufs([ch, ch.slice()], { fs }) - lufs(ch, { fs }), 3.01, 0.005)
})

test('silence and sub-window input → null', () => {
	is(lufs(new Float32Array(fs), { fs }), null)
	is(lufs(sine997(-23, 0.2), { fs }), null, 'shorter than one 400 ms block')
})

// Gates at −70 LKFS absolute (BS.1770-4 eq. 6), strict: a block at −70.3 LUFS is out, at −69.7 it counts
test('absolute gate at −70 LKFS', () => {
	is(lufs(tones([[5, -70.3]]), { fs }), null, '−70.3 LUFS gated out')
	almost(lufs(tones([[5, -69.7]]), { fs }), -69.7, 0.1, '−69.7 LUFS measured')
})

// EBU Tech 3341 §2.6 and cases 15-23: true peak within +0.2/−0.4 dB; FFS: fraction of full scale. 15-19: sines at
// fs/4, fs/6, fs/8 with 10 ms fades; 20-23: a single fs/4 period at 1.00 inside an fs/6 sine at 0.50, continuous in
// phase, synthesized at 4·fs, low-passed and taken with 0-3 samples offset.
function tpSine (div, a, deg, sec = 1) {
	let n = sec * fs, fade = 0.01 * fs, x = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		let w = Math.min(1, i / fade, (n - 1 - i) / fade), r = 0.5 - 0.5 * Math.cos(Math.PI * w)
		x[i] = r * a * Math.sin(2 * Math.PI * i / div + deg * Math.PI / 180)
	}
	return [x, x.slice()]
}
function tpBurst (off) {
	let up = 4, n4 = 2 * fs, x4 = new Float64Array(n4), at = Math.round(n4 / 2 / 24) * 24  // a rising zero of fs/6
	for (let i = 0; i < n4; i++) x4[i] = i >= at && i < at + 16 ? Math.sin(2 * Math.PI * (i - at) / 16) : 0.5 * Math.sin(2 * Math.PI * (i < at ? i : i - at - 16) / 24)
	for (let i = 0, f = 0.005 * up * fs; i < f; i++) { let w = 0.5 - 0.5 * Math.cos(Math.PI * i / f); x4[i] *= w; x4[n4 - 1 - i] *= w }
	// anti-aliasing: Kaiser-windowed sinc (β 12, 1023 taps) cut at fs/2
	let N = 1023, M = 511, i0 = z => { let s = 1, t = 1; for (let k = 1; k < 50; k++) s += t *= (z / 2 / k) ** 2; return s }
	let h = Float64Array.from({ length: N }, (_, k) => (k === M ? 0.25 : Math.sin(Math.PI * (k - M) / up) / (Math.PI * (k - M))) * i0(12 * Math.sqrt(1 - ((k - M) / M) ** 2)))
	let hs = h.reduce((a, b) => a + b), y = new Float32Array(Math.floor((n4 - off) / up))
	for (let j = 0; j < y.length; j++) { let c = j * up + off, v = 0; for (let k = 0; k < N; k++) { let i = c + M - k; if (i >= 0 && i < n4) v += h[k] * x4[i] } y[j] = v / hs }
	return [y, y.slice()]
}
test('EBU Tech 3341 cases 15-23: true peak within +0.2/−0.4 dB', () => {
	let within = (v, want, what) => ok(v <= want + 0.2 && v >= want - 0.4, `${what}: ${v.toFixed(3)} dBTP, want ${want} +0.2/−0.4`)
	within(truepeak(tpSine(4, 0.5, 0), { fs }), -6, 'case 15: fs/4, 0.50 FFS, 0°')
	within(truepeak(tpSine(4, 0.5, 45), { fs }), -6, 'case 16: fs/4, 0.50 FFS, 45°')
	within(truepeak(tpSine(6, 0.5, 60), { fs }), -6, 'case 17: fs/6, 0.50 FFS, 60°')
	within(truepeak(tpSine(8, 0.5, 67.5), { fs }), -6, 'case 18: fs/8, 0.50 FFS, 67.5°')
	within(truepeak(tpSine(4, 1.41, 45), { fs }), 3, 'case 19: fs/4, 1.41 FFS, 45°')
	for (let off = 0; off < 4; off++) within(truepeak(tpBurst(off), { fs }), 0, `case ${20 + off}: fs/4 burst, ${off} samples offset`)
})

test('EBU Tech 3342 cases 1-4: loudness range within ±1 LU', () => {
	almost(lra(tones([[20, -20], [20, -30]]), { fs }), 10, 1, 'case 1: −20 then −30 dBFS')
	almost(lra(tones([[20, -20], [20, -15]]), { fs }), 5, 1, 'case 2: −20 then −15 dBFS')
	almost(lra(tones([[20, -40], [20, -20]]), { fs }), 20, 1, 'case 3: −40 then −20 dBFS')
	almost(lra(tones([[20, -50], [20, -35], [20, -20], [20, -35], [20, -50]]), { fs }), 15, 1, 'case 4: −50 −35 −20 −35 −50 dBFS')
})

// ── Against reference meters, on speech-like bursts ─────────────────────────────
/** Deterministic speech-like signal: LCG noise band-shaped (one-pole 3 kHz low-pass, 150 Hz high-pass) in 4 Hz syllables,
 *  1-4 s phrases at random levels ending in a 0.4 s pause; sample peak −6 dBFS, channel c at 0.8^c. */
function babble (sr, seconds, nch = 1, seed = 7) {
	let n = Math.round(seconds * sr), x = new Float32Array(n), lp = 0, hp = 0, prev = 0, phrase = 0, level = 0.3, peak = 0
	let rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
	let a = Math.exp(-2 * Math.PI * 3000 / sr), b = Math.exp(-2 * Math.PI * 150 / sr)
	for (let i = 0; i < n; i++) {
		let t = i / sr
		if (t >= phrase) { phrase = t + 1 + 3 * rnd(); level = 0.02 + 0.5 * rnd() ** 2 }
		let env = phrase - t < 0.4 ? 0.003 : level * Math.sin(Math.PI * ((t * 4) % 1)) ** 2
		lp = (1 - a) * (rnd() * 2 - 1) + a * lp
		hp = b * (hp + lp - prev); prev = lp
		x[i] = env * hp
	}
	for (let v of x) peak = Math.max(peak, Math.abs(v))
	return Array.from({ length: nch }, (_, c) => x.map(v => v * 0.5 / peak * 0.8 ** c))
}
// [rate, seconds, channels, libebur128 1.2.6 integrated loudness (pyebur128 0.1.1, same float32 samples)]
const REFS = [
	[44100, 10, 2, -19.364270003173353],
	[8000, 20, 1, -20.083349135086866],
	[96000, 5, 1, -22.32271642233393],
	[48000, 30, 2, -21.620665120510523],
]
test('integrated loudness equals libebur128 to 1e-4 LU (8-96 kHz, mono and stereo)', () => {
	for (let [sr, sec, nch, I] of REFS) almost(lufs(babble(sr, sec, nch), { fs: sr }), I, 1e-4, `${sr} Hz, ${nch} ch`)
})
// [rate, seconds, channels, band-limited true peak of the babble, and of it clipped 18 dB (×8 into ±0.5): the samples
// read 32× oversampled through a Kaiser-windowed sinc, β 14, 128 taps a phase (scipy firwin), silence outside]
const TP_REFS = [
	[8000, 20, 1, -3.2608089267577913, 1.6761903084219987],
	[16000, 10, 1, -3.905804387484591, 1.4573661223182879],
	[44100, 10, 2, -5.49243029356415, 0.8355808847840162],
	[48000, 10, 2, -5.765709368091915, 0.8598145521764129],
]
// Clipping, like limiting, fills the band up to Nyquist and peaks between the points: the 32-tap Lanczos points of 1.1
// read the clipped babble 0.36-0.40 dB low, the 8 kHz babble 0.25 dB low; libebur128 reads the babble 0.08-0.84 dB low
test('true peak within 0.01 dB of the band-limited waveform at 8, 16, 44.1 and 48 kHz, clipped too', () => {
	for (let [sr, sec, nch, tp, tpClip] of TP_REFS) {
		let x = babble(sr, sec, nch), y = x.map(c => c.map(v => Math.max(-0.5, Math.min(0.5, v * 8))))
		for (let [what, d, want] of [['babble', x, tp], ['clipped', y, tpClip]]) {
			let v = truepeak(d, { fs: sr })
			ok(Math.abs(v - want) <= 0.01, `${sr} Hz ${what}: ${v.toFixed(4)} against ${want.toFixed(4)} dBTP`)
		}
	}
})

test('BS.1770-4 Table 3: 5.1 surrounds weighted 1.41, LFE excluded, by default', () => {
	// L/R −28, C −24, Ls/Rs −30 sums to −23 LUFS only when Ls/Rs carry 1.41.
	// Weighting all six at 1.0 gives −23.39 instead.
	let lfe = new Float32Array(20 * fs)
	let surround = [sine997(-28, 20), sine997(-28, 20), sine997(-24, 20), lfe, sine997(-30, 20), sine997(-30, 20)]
	almost(lufs(surround, { fs }), -23, 0.1)

	// a full-scale LFE must not move the reading at all
	surround[3] = sine997(-6, 20)
	almost(lufs(surround, { fs }), -23, 0.1, 'LFE excluded from the measurement')

	// explicit weights still override — and show what the old all-1.0 default cost:
	// Σ 10^(L/10)/2 over all six = (2·10^−2.8 + 10^−2.4 + 10^−0.6 + 2·10^−3)/2 = 0.13017
	// → 10·log10 = −8.86, i.e. the LFE alone swamps the reading by 14 LU
	almost(lufs(surround, { fs, weights: [1, 1, 1, 1, 1, 1] }), -8.855, 0.1, 'caller-supplied weights win')
})

// BS.1770-4 Table 4 (and Table 5, configuration I): sides within 60-120° weigh 1.41, backs past 120° 1.0; LFE out.
// 7.1 counted every channel at 1.0, the LFE included.
test('BS.1770-4 Table 4: 7.1 sides weighted 1.41, backs 1.0, LFE excluded, by default', () => {
	let z = new Float32Array(5 * fs), tone = sine997(-23, 5), at = c => Array.from({ length: 8 }, (_, k) => k === c ? tone : z)
	let front = lufs(at(0), { fs })
	almost(lufs(at(6), { fs }) - front, 10 * Math.log10(1.41), 0.001, 'side left (Ls) +1.49 dB')
	almost(lufs(at(4), { fs }) - front, 0, 0.001, 'back left (Lb) as a front channel')
	is(lufs(at(3), { fs }), null, 'LFE alone: nothing measured')
	is(lra(at(3), { fs }), null, 'LRA leaves the LFE out too')
})

test('lufs leaves the caller’s channels untouched (K-weighting never writes back to the input)', () => {
	let ch = sine997(-23, 1)
	let before = Float32Array.from(ch)
	lufs([ch, Float32Array.from(ch)], { fs })
	ok(ch.every((v, i) => v === before[i]))
})

test('truepeak — inter-sample peak: fs/4 sine at 45° phase reads ~0 dBTP while sample peak is −3 dBFS', () => {
	let n = 4800
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = Math.sin(Math.PI / 4 + Math.PI * i / 2) // fs/4, phase π/4 → samples ±0.7071
	let samplePeak = 0
	for (let v of d) samplePeak = Math.max(samplePeak, Math.abs(v))
	almost(20 * Math.log10(samplePeak), -3.01, 0.05, 'sample peak −3 dBFS')
	almost(truepeak(d, { fs }), 0, 0.3, 'true peak ~0 dBTP')
	almost(truepeak(sine997(-6, 2), { fs }), -6, 0.1, 'plain sine reads its level')
})

// Every point read in full through the same kernel (a sinc under a Kaiser window, β 8, 48 samples each side), silence
// outside the signal, and the parabola at each local maximum after the first sample: what the polyphase reads with its
// skips must equal, ends and short signals too
test('truepeak: the polyphase with its skips reads what every point read in full reads, ends and short signals included', () => {
	let sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
	let i0 = z => { let s = 1, t = 1; for (let k = 1; k < 60; k++) s += t *= (z / 2 / k) ** 2; return s }
	let kernel = x => sinc(x) * i0(8 * Math.sqrt(1 - (x / 48) ** 2)) / i0(8)
	let full = (ch, n) => {
		let K = []
		for (let p = 1; p < n; p++) { let h = [], s = 0; for (let j = 0; j < 96; j++) { let v = kernel(j - 47 - p / n); h.push(v); s += v } K.push(h.map(v => v / s)) }
		let pts = []
		for (let b = 0; b < ch.length; b++) { pts.push(Math.abs(ch[b])); for (let h of K) { let y = 0; for (let j = 0; j < 96; j++) { let i = b - 47 + j; if (i >= 0 && i < ch.length) y += h[j] * ch[i] } pts.push(Math.abs(y)) } }
		pts.push(0)
		let peak = Math.max(0, ...pts)
		for (let k = 1; k < pts.length - 1; k++) {
			let [l, m, r] = [pts[k - 1], pts[k], pts[k + 1]], c = 2 * m - l - r
			if (m >= l && m >= r && c > 0) peak = Math.max(peak, m + (l - r) ** 2 / (8 * c))
		}
		return peak > 0 ? 20 * Math.log10(peak) : -Infinity
	}
	let seed = 1, random = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5
	let noise = n => Float32Array.from({ length: n }, random)
	let click = (n, at) => { let d = new Float32Array(n); d[at] = 1; d[at + 1] = -1; return d }
	let fs4 = Float32Array.from({ length: 64 }, (_, i) => Math.sin(Math.PI / 4 + Math.PI * i / 2))
	// a last block of 5 samples (64 · 3 + 5): the block before it holds reads that reach past the end too
	let tail = noise(197); tail.fill(0, 0, 150); tail[185] = .9; tail[186] = -.9; tail[195] = .3; tail[196] = -.3
	let signals = { noise: noise(3000), 'click at the start': click(200, 0), 'click at the end': click(200, 198), 'fs/4 at 45°': fs4, 'shorter than the kernel': noise(20), 'one sample': noise(1), 'a short last block': tail }
	for (let [name, d] of Object.entries(signals)) for (let n of [2, 3, 4, 8])
		almost(truepeak(d, { fs, oversample: n }), full(d, n), 1e-9, `${name}, ${n}×`)
	is(truepeak(signals.noise, { fs, oversample: 2.5 }), truepeak(signals.noise, { fs, oversample: 3 }), 'a fraction rounds up')
	is(truepeak(new Float32Array(0), { fs }), -Infinity, 'no samples: silence')
	is(truepeak(new Float32Array(100), { fs }), -Infinity, 'zeros: silence')
})

// A steady full-scale tone is the slowest case: every block nears the peak. Upsampling through the resampler took
// about as long as the audio (1× realtime); the polyphase reads with their bounds take a small part of it (1.9 s of CPU
// for this minute with the 96-tap kernel and the parabola, 0.6 s with the 32-tap points alone). CPU time, not wall
// time: a loaded machine stretches the one, not the other.
test('truepeak — a minute of steady stereo tone, the slowest case, reads in well under a minute', () => {
	let ch = sine997(-3, 60), t = process.cpuUsage()
	almost(truepeak([ch, Float32Array.from(ch)], { fs }), -3, 0.1)
	let { user, system } = process.cpuUsage(t), ms = (user + system) / 1000
	ok(ms < 6000, `${ms.toFixed(0)} ms of CPU for 60 s`)
})

test('lra — EBU 3342: −20/−30 LUFS alternation → 10 LU; steady tone → ~0 LU', () => {
	let hi = sine997(-20, 20), lo = sine997(-30, 20)
	let ch = new Float32Array(hi.length + lo.length)
	ch.set(hi, 0); ch.set(lo, hi.length)
	let v = lra([ch, Float32Array.from(ch)], { fs })
	almost(v, 10, 1, 'two-level LRA ' + v.toFixed(2) + ' LU')
	let steady = sine997(-23, 20)
	ok(lra([steady, Float32Array.from(steady)], { fs }) < 0.5, 'steady tone ~0 LU')
})

test('replaygain — −23 LUFS stereo tone wants +5 dB', () => {
	let ch = sine997(-23, 10)
	let r = replaygain([ch, Float32Array.from(ch)], { fs })
	almost(r.gain, 5, 0.15)
	almost(r.lufs, -23, 0.1)
	almost(r.peak, 10 ** (-23 / 20), 0.001, 'sample peak of a −23 dBFS sine')
})

test('replaygain peak — max |sample| over every channel, including ones excluded from loudness', () => {
	let quiet = sine997(-23, 10), loud = sine997(-6, 10)
	almost(replaygain([quiet, loud], { fs }).peak, 10 ** (-6 / 20), 0.001, 'loudest channel wins')

	// negative excursions count: peak is |x|, not max(x)
	let asym = sine997(-23, 10)
	asym[1000] = -0.8
	almost(replaygain([asym, Float32Array.from(quiet)], { fs }).peak, 0.8, 0.001)

	// LFE carries no loudness weight but absolutely can clip
	let lfe = sine997(-3, 10)
	let surround = [quiet, Float32Array.from(quiet), Float32Array.from(quiet), lfe, Float32Array.from(quiet), Float32Array.from(quiet)]
	almost(replaygain(surround, { fs }).peak, 10 ** (-3 / 20), 0.001, 'LFE excluded from loudness, included in peak')

	is(replaygain(sine997(-23, 10), { fs }).peak > 0, true, 'mono input accepted')
})

test('dr — steady sine ~0 dB; pulse train much higher', () => {
	let s = sine997(-12, 12)
	let v = dr(s, { fs })
	almost(v, 0, 0.7, 'sine DR ' + v.toFixed(2))
	let n = 12 * fs
	let pulses = new Float32Array(n)
	for (let t = 0; t < n; t += fs / 4) for (let i = 0; i < 200 && t + i < n; i++) pulses[t + i] = Math.sin(2 * Math.PI * 997 * i / fs) * Math.exp(-i / 40)
	ok(dr(pulses, { fs }) > v + 6, 'pulse train DR ≫ sine DR')
})

// deterministic pseudo-noise (LCG) so the expected RMS is reproducible, not a magic constant
function lcgNoise (amp, n, seed = 12345) {
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff
		d[i] = amp * (2 * (seed / 0x7fffffff) - 1)
	}
	return d
}

test('contrast explicit mode — sine 0.4 amp foreground (RMS = 0.4/√2 → −10.97 dB) vs noise background', () => {
	let fg = sineAmp(0.4, 1)
	let bg = lcgNoise(0.004, fs)
	let bgSumSq = 0
	for (let v of bg) bgSumSq += v * v
	let expectedBgDb = 10 * Math.log10(bgSumSq / bg.length) // power-average RMS in dB — same formula the kernel uses
	let buf = new Float32Array(fg.length + bg.length)
	buf.set(fg, 0); buf.set(bg, fg.length)
	let r = speechContrast(buf, { fs, fg: [0, fg.length / fs], bg: [fg.length / fs, bg.length / fs] })
	almost(r.foreground, -10.97, 0.1, '0.4 amp sine → 20·log10(0.4/√2) = −10.97 dB')
	almost(r.background, expectedBgDb, 0.1, 'noise background RMS matches the same power-average formula')
	ok(r.pass, 'quiet noise floor vs speech-level tone ≫ 20 dB (WCAG 2.0 SC 1.4.7 pass)')
})

test('contrast WCAG 2.0 SC 1.4.7 boundary — 20.5 dB difference passes, 19 dB fails (20 dB pass criterion, Audacity Contrast manual)', () => {
	let bgAmp = 0.01
	let bg = sineAmp(bgAmp, 1)
	let passFg = sineAmp(bgAmp * 10 ** (20.5 / 20), 1) // amplitude ratio → exact dB difference (the /√2 RMS factor cancels)
	let failFg = sineAmp(bgAmp * 10 ** (19 / 20), 1)

	let bufPass = new Float32Array(passFg.length + bg.length)
	bufPass.set(passFg, 0); bufPass.set(bg, passFg.length)
	let rPass = speechContrast(bufPass, { fs, fg: [0, 1], bg: [1, 1] })
	almost(rPass.contrast, 20.5, 0.05, '20.5 dB fg−bg difference')
	is(rPass.pass, true, '≥20 dB → pass')

	let bufFail = new Float32Array(failFg.length + bg.length)
	bufFail.set(failFg, 0); bufFail.set(bg, failFg.length)
	let rFail = speechContrast(bufFail, { fs, fg: [0, 1], bg: [1, 1] })
	almost(rFail.contrast, 19, 0.05, '19 dB fg−bg difference')
	is(rFail.pass, false, '<20 dB → fail')
})

test('contrast auto mode — 1 s tone (−11 dB RMS) + 1 s near-silence (−51 dB RMS): frame pooling matches explicit-mode values', () => {
	let fgAmp = 10 ** (-11 / 20) * Math.SQRT2 // amp s.t. RMS (amp/√2) = −11 dB
	let bgAmp = 10 ** (-51 / 20) * Math.SQRT2 // amp s.t. RMS (amp/√2) = −51 dB
	let tone = sineAmp(fgAmp, 1), quiet = sineAmp(bgAmp, 1)
	let buf = new Float32Array(tone.length + quiet.length)
	buf.set(tone, 0); buf.set(quiet, tone.length)
	let r = speechContrast(buf, { fs }) // auto mode: default threshold −30 dB, 10 ms frames
	almost(r.foreground, -11, 0.5, 'tone frames (≥ −30 dB) pool to ~−11 dB RMS')
	almost(r.background, -51, 0.5, 'near-silence frames (< −30 dB) pool to ~−51 dB RMS')
})

test('contrast edge — pure tone, nothing below threshold → empty background pool, contrast = +Infinity, pass = true', () => {
	let r = speechContrast(sineAmp(0.3, 1), { fs })
	is(r.background, -Infinity, 'no frame falls below the −30 dB default threshold')
	is(r.contrast, Infinity)
	is(r.pass, true)
})

test('sounds — three 0.5 s bursts ≥2 s apart, minSound 0.4 → 3 regions (±0.02 s = one 10 ms chunk each side)', () => {
	let buf = new Float32Array(Math.round(6.5 * fs))
	let burst = sine997(-6, 0.5) // well above the default −30 dB threshold
	let starts = [0.5, 3, 5.5]
	for (let s of starts) buf.set(burst, Math.round(s * fs))
	let regions = sounds(buf, { fs, minSound: 0.4 })
	is(regions.length, 3, '2 s gaps ≥ default 1 s minSilence keep bursts distinct')
	regions.forEach((r, i) => {
		almost(r.at, starts[i], 0.02, `region ${i} at ~${starts[i]} s`)
		almost(r.duration, 0.5, 0.02, `region ${i} duration ~0.5 s`)
		is(r.label, `Sound ${i + 1}`)
	})
})

test('sounds merge — two 0.5 s bursts 0.5 s apart, default minSilence 1 s → single region spanning both', () => {
	let buf = new Float32Array(Math.round(1.5 * fs))
	let burst = sine997(-6, 0.5)
	buf.set(burst, 0)
	buf.set(burst, Math.round(1 * fs))
	let regions = sounds(buf, { fs })
	is(regions.length, 1, '0.5 s gap < 1 s default minSilence → merged')
	almost(regions[0].at, 0, 0.02)
	almost(regions[0].duration, 1.5, 0.02)
})

test('sounds minSound merge — two 0.2 s bursts 0.3 s apart (minSilence 0.1, gap stays separate) fold into one region (minSound 1)', () => {
	let buf = new Float32Array(Math.round(0.7 * fs))
	let burst = sine997(-6, 0.2)
	buf.set(burst, 0)
	buf.set(burst, Math.round(0.5 * fs))
	let regions = sounds(buf, { fs, minSilence: 0.1, minSound: 1 })
	is(regions.length, 1, 'both bursts fold into a single region (minSound 1 > either burst)')
	almost(regions[0].at, 0, 0.02)
	almost(regions[0].duration, 0.7, 0.02)
})

test('sounds padding — pre/post 0.1 s extend into adjacent silence; a region abutting t=0 clamps there', () => {
	let buf = new Float32Array(Math.round(2 * fs))
	let burst = sine997(-6, 0.5)
	buf.set(burst, Math.round(0.05 * fs)) // only 0.05 s of silence precedes it — less than pre=0.1
	let regions = sounds(buf, { fs, pre: 0.1, post: 0.1 })
	is(regions.length, 1)
	almost(regions[0].at, 0, 0.02, 'pre-padding clamps at t=0 (only 0.05 s silence available)')
	almost(regions[0].duration, 0.65, 0.02, 'end padded the full 0.1 s (ample trailing silence)')
})

test('sounds measurement modes — peak ("most sensitive", Audacity manual) flags a low-duty-cycle click train that rms misses', () => {
	let buf = new Float32Array(Math.round(2 * fs))
	// single-sample 0.5-amplitude spikes every 0.2 s:
	// peak dB = 20·log10(0.5) ≈ −6 dB (≥ −30 default threshold)
	// per-chunk RMS with 1 sample of 480 in the 10 ms chunk = 0.5·√(1/480) → ≈ −32.8 dB (< −30, crest factor invisible to RMS)
	for (let t = 0; t < 2; t += 0.2) buf[Math.round(t * fs)] = 0.5
	let peakRegions = sounds(buf, { fs, measurement: 'peak' })
	let rmsRegions = sounds(buf, { fs, measurement: 'rms' })
	ok(peakRegions.length > 0, 'peak mode detects the click train')
	is(rmsRegions.length, 0, 'rms mode misses it — crest factor invisible to averaging measurements')
})

test('sounds padding — sides pad independently against sound boundaries; labels may overlap labels, never sounds (Label Sounds manual: "labels can overlap other labels, but cannot overlap previous or following sounds")', () => {
	// two 1 s sounds at [1,2) and [4,5) in 6 s, pre = post = 2.5:
	// each pad claims from the raw 2 s gap independently → labels [0,4] and [2,6] overlap over [2,4]
	let buf = new Float32Array(Math.round(6 * fs))
	let burst = sine997(-6, 1)
	buf.set(burst, Math.round(1 * fs))
	buf.set(burst, Math.round(4 * fs))
	let regions = sounds(buf, { fs, pre: 2.5, post: 2.5 })
	is(regions.length, 2)
	almost(regions[0].at, 0, 0.02, 'first: only 1 s of leading silence → clamps at 0')
	almost(regions[0].at + regions[0].duration, 4, 0.02, 'first: trailing pad = min(2.5, full 2 s gap), independent of the neighbour label')
	almost(regions[1].at, 2, 0.02, 'second: leading pad = min(2.5, full 2 s gap) — label overlap permitted')
	almost(regions[1].at + regions[1].duration, 6, 0.02, 'second: 1 s of trailing silence → clamps at the end')
})

test('contrast mixed mode — explicit fg is excluded from the auto background scan (no self-contamination)', () => {
	// 1 s −6 dBFS tone with a zeroed 0.1 s dip inside the fg, then 1 s −36 dBFS tone (RMS −39.01 dB).
	// bg (auto) must measure the trailing second, not the dip inside the caller's own foreground.
	let buf = new Float32Array(Math.round(2 * fs))
	buf.set(sine997(-6, 1), 0)
	buf.fill(0, Math.round(0.5 * fs), Math.round(0.6 * fs))
	buf.set(sine997(-36, 1), Math.round(1 * fs))
	let r = speechContrast(buf, { fs, fg: [0, 1] })
	// fg: −6 dBFS sine RMS = −9.01 dB over 0.9 of the slice → −9.01 + 10·log10(0.9) = −9.47 dB
	almost(r.foreground, -9.47, 0.1, 'explicit foreground, dip included')
	almost(r.background, -39.01, 0.3, 'auto background = trailing tone RMS, not the in-fg dip')
	ok(r.pass, '≈29.5 dB contrast passes WCAG')
})
