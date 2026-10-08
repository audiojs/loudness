// True peak (dBTP): the peak of the band-limited waveform the samples stand for. ITU-R BS.1770-5 Annex 2 reads it
// oversampled, rectified, the maximum; recommends 5 allows "a method that gives similar or superior results". The
// waveform is read at `oversample` points a sample (4: 192 kHz from 48 kHz) through a 96-tap Kaiser-windowed sinc
// (β 8), silent outside the signal, and each local maximum of the points is refined by the parabola through it and its
// neighbours: the peak between the points. Against the waveform read 32× through a Kaiser-windowed sinc (β 14, 128
// taps a phase), speech, white noise, noise clipped 18 dB, limited speech and EBU Tech 3341 cases 15-23 read within
// 0.01 dB at 8-48 kHz. The 32-tap Lanczos kernel before it, its points alone, read clipped or limited material up to
// 0.4 dB low: it attenuates the last few percent below Nyquist, and a limited waveform peaks between the points.
// Speed: the peak is a maximum, so an interval is read only where it could pass the peak found so far; a parabola's
// vertex rises at most 9/8 over its largest point (`RISE`). Summed by parts twice about the interval's samples x0, x1,
// a point is (1 − B)·x0 + B·x1 + Σ e·Δ²x over its taps, B ≈ p/n in (0, 1): at most the larger sample plus Σ|e|·|Δ²x|,
// tight wherever the waveform is smooth (Σ|w|·|x| never is: the kernel's absolute sum is 2.5-3.1). Bounds skip in
// turn: per BLK samples, then per interval with its own samples, each block of the window at its largest |Δ²x|
// (`bend`); the nearest taps read, the rest bounded so (`far`), and each parabola bounded over what they leave out
// (`most`); all points read folded (phases p and n − p mirror each other: 3 products a pair of taps for the 3 phases
// of 4×, not 6), each parabola bounded over what folding rounds differently. Only an interval that can still pass is
// read as before, so the peak is the same to the bit. Ten minutes of speech: 1 interval in 3400 passes the block
// bounds, ~10 are read; a steady tone: 1 in 11 is read folded, 1 in 150000 in full.

const HALF = 48, TAPS = 2 * HALF, NEAR = 6, BETA = 8, BLK = 8, NB = TAPS / BLK + 1
// 9/8 a hair over: a bound and a read round differently, and a skip must never drop a read that passes
const RISE = 9 / 8 * (1 + 2 ** -20)
// how far a folded point may be from its read, a fraction of the peak: each rounds ~1e-14 of Σ|w·x|, at most ~3 peaks
const SLACK = 2 ** -36
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 50; k++) s += t *= (x / 2 / k) ** 2; return s }
/** The kernel at offset x: sinc under a Kaiser window HALF samples each side. */
const kernel = x => Math.abs(x) >= HALF ? 0 : sinc(x) * i0(BETA * Math.sqrt(1 - (x / HALF) ** 2)) / i0(BETA)

// Per phase p/n (0 < p < n): the weights w of taps 1−HALF … HALF, scaled to sum 1; tap j reads x[base + 1 − HALF + j],
// in block (r + 1 + j) >> 3 of NB for an interval starting r samples into its block. e[j]: Δ²x's weight once summed by
// parts. bend[k]: the most Σ|e| any phase and r put in block k; far[r·NB + k]: that past the 2·NEAR nearest taps. The
// nearest taps' part is a short filter v (taps HALF − 1 − NEAR … HALF + NEAR). Folded, tap HALF − 1 − k paired with
// HALF + k as the sum s[k] and difference d[k] of their samples: phase p reads Σ even·s + Σ odd·d, phase n − p the
// same less, so both at most |Σ even·s| + |Σ odd·d|. Phases p ≤ n/2 hold them: `wide` for w, `near` for v.
const kernels = new Map()
function phases (n) {
	if (kernels.has(n)) return kernels.get(n)
	let list = [], g = n >> 1, bend = new Float64Array(NB), far = new Float64Array(BLK * NB)
	let wide = [new Float64Array(g * HALF), new Float64Array(g * HALF)], near = [new Float64Array(g * (NEAR + 1)), new Float64Array(g * (NEAR + 1))]
	const fold = ([even, odd], h, p, w) => { for (let k = 0; k < h; k++) { let a = w[HALF - 1 - k], b = w[HALF + k]; even[p * h + k] = (a + b) / 2; odd[p * h + k] = (a - b) / 2 } }
	for (let p = 1; p < n; p++) {
		let w = new Float64Array(TAPS), sum = 0
		for (let j = 0; j < TAPS; j++) sum += w[j] = kernel(j + 1 - HALF - p / n)
		for (let j = 0; j < TAPS; j++) w[j] /= sum
		list.push(w)
		let e = new Float64Array(TAPS), v = new Float64Array(TAPS), B = 0
		for (let j = 0; j < TAPS; j++) B += w[j] * (j + 1 - HALF)
		for (let j = 0; j < TAPS; j++) for (let i = 0; i < TAPS; i++) if (j < HALF ? i < j : i > j) e[j] += w[i] * Math.abs(i - j)
		v[HALF - 1] = 1 - B; v[HALF] = B
		for (let j = HALF - NEAR; j < HALF + NEAR; j++) { v[j - 1] += e[j]; v[j] -= 2 * e[j]; v[j + 1] += e[j] }
		for (let r = 0; r < BLK; r++) {
			let b = new Float64Array(NB), f = new Float64Array(NB)
			for (let j = 0; j < TAPS; j++) { let k = (r + 1 + j) >> 3, a = Math.abs(e[j]); b[k] += a; if (j < HALF - NEAR || j >= HALF + NEAR) f[k] += a }
			for (let k = 0; k < NB; k++) { bend[k] = Math.max(bend[k], b[k]); far[r * NB + k] = Math.max(far[r * NB + k], f[k]) }
		}
		if (p <= g) { fold(wide, HALF, p - 1, w); fold(near, NEAR + 1, p - 1, v) }
	}
	let set = { list, bend, far, wide, near }
	kernels.set(n, set)
	return set
}

/** Vertex of the parabola through equally spaced l, m, r when m is their largest, else m. */
const vertex = (l, m, r) => { let c = 2 * m - l - r; return m >= l && m >= r && c > 0 ? m + (l - r) * (l - r) / (8 * c) : m }

/** The most vertex(l, m, r) can be where each of l, m, r may be off by d. */
function most (l, m, r, d) {
	if (m + d < l - d || m + d < r - d) return m + d
	let s = (l < r ? r - l : l - r) + 2 * d, t = 2 * m - l - r - 4 * d
	// past the vertex's own conditions, |l − r| ≤ c, so the rise (l − r)²/8c is at most |l − r|/8
	return m + d + (t > s ? s * s / t : s) / 8
}

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

/** The most interval (base, base + 1) reaches past `peak`: its points x[base], the n − 1 reads, x[base + 1], the parabola
 *  through each local maximum, and the one at x[base] beside the interval before's last point, read only where it
 *  could pass. */
function reach (x, list, base, q, peak) {
	let n = list.length + 1
	q[0] = Math.abs(x[base]); q[n] = base + 1 < x.length ? Math.abs(x[base + 1]) : 0
	for (let p = 1; p < n; p++) q[p] = Math.abs(read(x, list[p - 1], base))
	for (let p = 1; p < n; p++) { let v = vertex(q[p - 1], q[p], q[p + 1]); if (v > peak) peak = v }
	if (base > 0 && 9 / 8 * q[0] > peak && q[0] >= q[1]) { let v = vertex(Math.abs(read(x, list[n - 2], base - 1)), q[0], q[1]); if (v > peak) peak = v }
	return peak
}

/** Block P − 6 of x's largest |x| and |Δ²x| (silence outside the signal: Δ²x[−1] = x[0], Δ²x[len] = x[len − 1]) into
 *  a ring of 16, at P & 15. Math.max, not a branch: which sample is largest is a coin toss the branch predictor loses. */
function block (x, P, mx, m2) {
	let len = x.length, i = (P - 6) * BLK, z = i + BLK, a = 0, e = 0
	if (i > 0 && z < len) for (; i < z; i++) { a = Math.max(a, Math.abs(x[i])); e = Math.max(e, Math.abs(x[i - 1] - 2 * x[i] + x[i + 1])) }
	else for (i = Math.max(i, -1), z = Math.min(z, len + 1); i < z; i++) {
		let l = i > 0 && i <= len ? x[i - 1] : 0, c = i >= 0 && i < len ? x[i] : 0, r = i + 1 < len ? x[i + 1] : 0
		a = Math.max(a, Math.abs(c)); e = Math.max(e, Math.abs(l - 2 * c + r))
	}
	mx[P & 15] = a; m2[P & 15] = e
}

/** Whether a parabola through points q[0 … n], each within d of its read, can pass peak. */
const passes = (q, n, d, peak) => { for (let p = 1; p < n; p++) if (most(q[p - 1], q[p], q[p + 1], d) > peak) return true; return false }

/**
 * @param {Float32Array|Float32Array[]} channels — mono buffer or channel array
 * @param {object} opts — { fs=48000, oversample=4 } — points a sample (a fraction rounds up)
 * @returns {number} true peak in dBTP (−Infinity for silence)
 */
export default function truepeak (channels, { fs = 48000, oversample = 4 } = {}) {
	if (channels[0]?.length === undefined) channels = [channels]
	let n = Math.ceil(oversample), peak = 0, loud = channels[0], at = 0
	for (let x of channels) for (let i = 0; i < x.length; i++) { let a = Math.abs(x[i]); if (a > peak) { peak = a; loud = x; at = i } }
	if (n < 2) return peak > 0 ? 20 * Math.log10(peak) : -Infinity
	let { list, bend, far, wide: [we, wo], near: [ne, no] } = phases(n), g = n >> 1, last = list[n - 2]
	let q = new Float64Array(n + 1), s = new Float64Array(HALF), d = new Float64Array(HALF), mx = new Float64Array(16), m2 = new Float64Array(16)
	// the loudest first, the intervals beside the largest sample: the higher the peak starts, the more the bounds skip
	// (and reading an interval twice changes nothing)
	if (peak > 0) for (let base = Math.max(0, at - 1); base <= at; base++) peak = reach(loud, list, base, q, peak)
	for (let x of channels) {
		// the blocks of the window of block J's intervals, J − 6 … J + 6, at mx, m2[(J + k) & 15], k = 0 … 12, read ahead
		let len = x.length, nb = Math.ceil(len / BLK)
		for (let P = 0; P < NB - 1; P++) block(x, P, mx, m2)
		// the last point of the interval before, as each stage last estimated it (base, value, within)
		let b1 = -1, l1 = 0, d1 = 0, b2 = -1, l2 = 0
		for (let J = 0; J < nb; J++) {
			// the block's intervals (base, base + 1), base = 8J … 8J + 7: their points, samples to x[8J + 8], at most hi
			block(x, J + NB - 1, mx, m2)
			let bent = 0
			for (let k = 0; k < NB; k++) bent += bend[k] * m2[(J + k) & 15]
			if (RISE * (Math.max(mx[(J + 6) & 15], mx[(J + 7) & 15]) + bent) <= peak) continue
			for (let r = 0, base = J * BLK; r < BLK && base < len; r++, base++) {
				let a = Math.abs(x[base]), b = base + 1 < len ? Math.abs(x[base + 1]) : 0, rim = base > 0 && RISE * a > peak
				if (RISE * (Math.max(a, b) + bent) <= peak) continue
				// a window inside the signal: its points through the nearest taps, the rest bounded, then through all, folded
				if (base >= HALF - 1 && base + HALF < len) {
					let dd = peak * SLACK + far[r * NB] * m2[J & 15], de = 0
					for (let k = 1, i = r * NB + 1; k < NB; k += 2, i += 2) { dd += far[i] * m2[(J + k) & 15]; de += far[i + 1] * m2[(J + k + 1) & 15] }
					dd += de
					for (let k = 0; k <= NEAR; k++) { let u = x[base - k], v = x[base + 1 + k]; s[k] = u + v; d[k] = u - v }
					q[0] = a; q[n] = b
					let top = Math.max(a, b)
					for (let p = 0, h = NEAR + 1; p < g; p++) {
						let e = 0, o = 0
						for (let k = 0; k < h; k++) { e += ne[p * h + k] * s[k]; o += no[p * h + k] * d[k] }
						let u = q[p + 1] = Math.abs(e + o), v = q[n - 1 - p] = Math.abs(e - o)
						top = Math.max(top, u + dd, v + dd)
					}
					let pass = RISE * top > peak && (passes(q, n, dd, peak) || rim && (b1 !== base - 1 || most(l1, a, q[1], Math.max(d1, dd)) > peak))
					b1 = base; l1 = q[n - 1]; d1 = dd
					if (!pass) continue
					for (let k = NEAR + 1; k < HALF; k++) { let u = x[base - k], v = x[base + 1 + k]; s[k] = u + v; d[k] = u - v }
					for (let p = 0; p < g; p++) {
						// two running sums each: independent adds pipeline. Phase n/2 is its own mirror image: no odd part
						let e = 0, f = 0, o = 0, h = 0
						if (2 * p + 2 === n) for (let k = 0, i = p * HALF; k < HALF; k += 2, i += 2) { e += we[i] * s[k]; f += we[i + 1] * s[k + 1] }
						else for (let k = 0, i = p * HALF; k < HALF; k += 2, i += 2) { e += we[i] * s[k]; f += we[i + 1] * s[k + 1]; o += wo[i] * d[k]; h += wo[i + 1] * d[k + 1] }
						e += f; o += h
						q[p + 1] = Math.abs(e + o); q[n - 1 - p] = Math.abs(e - o)
					}
					dd = peak * SLACK
					pass = passes(q, n, dd, peak) || rim && most(b2 === base - 1 ? l2 : Math.abs(read(x, last, base - 1)), a, q[1], dd) > peak
					b2 = base; l2 = q[n - 1]
					if (!pass) continue
				}
				peak = reach(x, list, base, q, peak)
			}
		}
	}
	return peak > 0 ? 20 * Math.log10(peak) : -Infinity
}
