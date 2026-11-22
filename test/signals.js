// The sounds the reference values are of (references.json), as test.js makes them; run, it writes each as a float32 WAV
// for the reference tools to read:  node test/signals.js <dir>
import { writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Deterministic speech-like signal: LCG noise band-shaped (one-pole 3 kHz low-pass, 150 Hz high-pass) in 4 Hz syllables,
 *  1-4 s phrases at random levels ending in a 0.4 s pause; sample peak −6 dBFS, channel c at 0.8^c. */
export function babble (sr, seconds, nch = 1, seed = 7) {
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

/** Clipped 18 dB: ×8 into ±0.5 */
export const clip = x => x.map(c => c.map(v => Math.max(-0.5, Math.min(0.5, v * 8))))

/** [rate, seconds, channels, seed] of each babble; its name in references.json is `rate-seconds-channels-seed` */
export const CASES = [
	[8000, 20, 1, 7], [16000, 10, 1, 7], [44100, 10, 2, 7], [48000, 10, 2, 7], [48000, 30, 2, 7], [96000, 5, 1, 7],
	[44100, 60, 1, 11], [48000, 90, 2, 3],
]

function wav (ch, sr) {
	let n = ch[0].length, c = ch.length, b = Buffer.alloc(44 + 4 * n * c)
	b.write('RIFF', 0); b.writeUInt32LE(36 + 4 * n * c, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(c, 22)
	b.writeUInt32LE(sr, 24); b.writeUInt32LE(4 * c * sr, 28); b.writeUInt16LE(4 * c, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(4 * n * c, 40)
	for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) b.writeFloatLE(ch[k][i], 44 + 4 * (i * c + k))
	return b
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	let dir = process.argv[2]
	if (!dir) { console.error('node test/signals.js <dir>'); process.exit(1) }
	mkdirSync(dir, { recursive: true })
	for (let [sr, sec, nch, seed] of CASES) {
		let x = babble(sr, sec, nch, seed), name = `${sr}-${sec}-${nch}-${seed}`
		writeFileSync(`${dir}/${name}.wav`, wav(x, sr))
		writeFileSync(`${dir}/${name}.clip.wav`, wav(clip(x), sr))
	}
}
