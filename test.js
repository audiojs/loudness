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

test('EBU 3341 case 1 — stereo 997 Hz sine at −23 dBFS → −23.0 ±0.1 LUFS', () => {
	let ch = sine997(-23, 20)
	almost(lufs([ch, Float32Array.from(ch)], { fs }), -23, 0.1)
})

test('EBU 3341 case 2 — stereo 997 Hz sine at −33 dBFS → −33.0 ±0.1 LUFS', () => {
	let ch = sine997(-33, 20)
	almost(lufs([ch, Float32Array.from(ch)], { fs }), -33, 0.1)
})

test('mono is 3.01 LU below the same stereo signal (channel-sum, BS.1770-4 §2)', () => {
	let ch = sine997(-23, 10)
	let stereo = lufs([ch, Float32Array.from(ch)], { fs })
	let mono = lufs(ch, { fs })
	almost(stereo - mono, 3.01, 0.05)
})

test('EBU 3341 case 3 — quiet lead/tail (−36 dBFS) gated out around a −23 dBFS body → −23.0 ±0.1', () => {
	let quiet = sine997(-36, 5), body = sine997(-23, 20)
	let ch = new Float32Array(quiet.length * 2 + body.length)
	ch.set(quiet, 0)
	ch.set(body, quiet.length)
	ch.set(quiet, quiet.length + body.length)
	almost(lufs([ch, Float32Array.from(ch)], { fs }), -23, 0.1)
})

test('silence and sub-window input → null', () => {
	is(lufs(new Float32Array(fs), { fs }), null)
	is(lufs(sine997(-23, 0.2), { fs }), null, 'shorter than one 400 ms block')
})

test('44.1 kHz sample rate — case 1 still within ±0.1', () => {
	let sr = 44100
	let a = 10 ** (-23 / 20)
	let ch = new Float32Array(20 * sr)
	for (let i = 0; i < ch.length; i++) ch[i] = a * Math.sin(2 * Math.PI * 997 * i / sr)
	almost(lufs([ch, Float32Array.from(ch)], { fs: sr }), -23, 0.1)
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
