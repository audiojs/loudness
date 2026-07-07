import test, { almost, ok, is } from 'tst'
import { lufs, truepeak, lra, replaygain, dr } from './index.js'

const fs = 48000

// EBU Tech 3341 sine: level in dBFS where a full-scale sine peaks at 1.0
function sine997 (dbfs, seconds, sr = fs) {
	let a = 10 ** (dbfs / 20)
	let d = new Float32Array(Math.round(seconds * sr))
	for (let i = 0; i < d.length; i++) d[i] = a * Math.sin(2 * Math.PI * 997 * i / sr)
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
