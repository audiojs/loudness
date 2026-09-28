// True peak (dBTP): the peak of the band-limited waveform the samples stand for. ITU-R BS.1770-5 Annex 2 reads it
// oversampled, rectified, the maximum; recommends 5 allows "a method that gives similar or superior results". The
// waveform is read at `oversample` points a sample (4: 192 kHz from 48 kHz) through a 96-tap Kaiser-windowed sinc
// (β 8), silent outside the signal, and each local maximum of the points is refined by the parabola through it and its
// neighbours: the peak between the points. Against the waveform read 32× through a Kaiser-windowed sinc (β 14, 128
// taps a phase), speech, white noise, noise clipped 18 dB, limited speech and EBU Tech 3341 cases 15-23 read within
// 0.01 dB at 8-48 kHz. The 32-tap Lanczos kernel before it, its points alone, read clipped or limited material up to
// 0.4 dB low: it attenuates the last few percent below Nyquist, and a limited waveform peaks between the points.
// Speed: a point reads at most its window's largest sample times the kernel's absolute sum, and a parabola's vertex at
// most 9/8 of its largest point (`gain`): blocks whose neighbourhood can't pass the peak found so far are skipped,
// loudest first. Within a block, an interval whose points can't pass it either (the twelve nearest taps read, the
// rest bounded at the block's largest sample: `far`) is skipped before its full reads.

const HALF = 48, TAPS = 2 * HALF, BLOCK = 64, NEAR = 6, BETA = 8
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 50; k++) s += t *= (x / 2 / k) ** 2; return s }
/** The kernel at offset x: sinc under a Kaiser window HALF samples each side. */
const kernel = x => Math.abs(x) >= HALF ? 0 : sinc(x) * i0(BETA * Math.sqrt(1 - (x / HALF) ** 2)) / i0(BETA)

// Per phase p/n (0 < p < n): the weights of taps 1−HALF … HALF, scaled to sum 1, and `far`, their absolute sum past the
// 2·NEAR nearest; `gain`, 9/8 of the largest absolute sum of any phase
const kernels = new Map()
function phases (n) {
	if (kernels.has(n)) return kernels.get(n)
	let list = [], gain = 1
	for (let p = 1; p < n; p++) {
		let w = new Float64Array(TAPS), sum = 0, abs = 0, near = 0
		for (let j = 0; j < TAPS; j++) sum += w[j] = kernel(j + 1 - HALF - p / n)
		for (let j = 0; j < TAPS; j++) { w[j] /= sum; abs += Math.abs(w[j]); if (j >= HALF - NEAR && j < HALF + NEAR) near += Math.abs(w[j]) }
		gain = Math.max(gain, abs)
		list.push({ w, far: abs - near })
	}
	let set = { list, gain: 9 / 8 * gain }
	kernels.set(n, set)
	return set
}

/** Vertex of the parabola through equally spaced l, m, r when m is their largest, else m. */
const vertex = (l, m, r) => { let c = 2 * m - l - r; return m >= l && m >= r && c > 0 ? m + (l - r) * (l - r) / (8 * c) : m }

/** The point at base + p/n, read through phase weights w (taps base+1−HALF … base+HALF, silence outside the signal). */
function read (x, w, base) {
	let lo = base + 1 - HALF, len = x.length
	if (lo >= 0 && lo + TAPS <= len) {
		// four running sums: independent adds pipeline
		let a = 0, b = 0, c = 0, d = 0
		for (let j = 0; j < TAPS; j += 4) { a += x[lo + j] * w[j]; b += x[lo + j + 1] * w[j + 1]; c += x[lo + j + 2] * w[j + 2]; d += x[lo + j + 3] * w[j + 3] }
		return a + b + c + d
	}
	let v = 0
	for (let j = Math.max(0, -lo), e = Math.min(TAPS, len - lo); j < e; j++) v += x[lo + j] * w[j]
	return v
}

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, oversample=4 } — points a sample (a fraction rounds up)
 * @returns {number} true peak in dBTP (−Infinity for silence)
 */
export default function truepeak (channels, { fs = 48000, oversample = 4 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let n = Math.ceil(oversample), peak = 0
	for (let x of channels) for (let i = 0; i < x.length; i++) { let a = Math.abs(x[i]); if (a > peak) peak = a }
	if (n < 2) return peak > 0 ? 20 * Math.log10(peak) : -Infinity
	let { list, gain } = phases(n), last = list[n - 2].w, q = new Float64Array(n + 1)
	for (let x of channels) {
		let len = x.length, blocks = Math.ceil(len / BLOCK), top = new Float64Array(blocks)
		for (let i = 0; i < len; i++) { let a = Math.abs(x[i]), b = i / BLOCK | 0; if (a > top[b]) top[b] = a }
		// an interval's reads reach HALF samples back and HALF on (HALF ≤ BLOCK): its block and the two beside
		let reach = Float64Array.from(top, (t, b) => Math.max(t, top[b - 1] || 0, top[b + 1] || 0))
		let order = Uint32Array.from(reach.keys()).sort((a, b) => reach[b] - reach[a])
		for (let b of order) {
			if (reach[b] * gain <= peak) break
			for (let base = b * BLOCK, end = Math.min(len, base + BLOCK); base < end; base++) {
				// the interval (base, base + 1): a bound on it, then its points x[base], the n − 1 reads, x[base + 1]
				let hi = Math.max(Math.abs(x[base]), base + 1 < len ? Math.abs(x[base + 1]) : 0)
				for (let { w, far } of list) {
					let v = 0
					for (let j = HALF - NEAR; j < HALF + NEAR; j++) { let i = base + 1 - HALF + j; if (i >= 0 && i < len) v += x[i] * w[j] }
					hi = Math.max(hi, Math.abs(v) + far * reach[b])
				}
				if (9 / 8 * hi <= peak) continue
				q[0] = Math.abs(x[base]); q[n] = base + 1 < len ? Math.abs(x[base + 1]) : 0
				for (let p = 1; p < n; p++) q[p] = Math.abs(read(x, list[p - 1].w, base))
				for (let p = 1; p < n; p++) { let v = vertex(q[p - 1], q[p], q[p + 1]); if (v > peak) peak = v }
				// x[base] too, past the first sample, beside the last point of the interval before: read only when it could
				// pass the peak
				if (base > 0 && 9 / 8 * q[0] > peak && q[0] >= q[1]) { let v = vertex(Math.abs(read(x, last, base - 1)), q[0], q[1]); if (v > peak) peak = v }
			}
		}
	}
	return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}
