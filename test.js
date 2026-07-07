import test, { almost, ok, is } from 'tst'
import { lufs } from './index.js'

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
