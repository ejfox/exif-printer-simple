/**
 * EJ-taste v1 scoring, in the browser.
 *
 * Ranks photos the way EJ likes them: contrast, tonal range, symmetry, and one visible
 * subject as centered as possible. Port of ejtaste (github.com/ejfox/ejtaste), sharing
 * its blend weights exactly so the app and the MCP server agree on what is good.
 *
 * The weights live in TASTE_WEIGHTS and are the single source of truth for both.
 */

export const SAMPLE_SIZE = 256

/** Blend weights, applied to z-scored metrics across the set. From ejtaste/cld_taste.py. */
export const TASTE_WEIGHTS = {
  contrast: 0.31,
  tonalRange: 0.13,
  symmetry: 0.28,
  subject: 0.28
} as const

/** A frame darker than this with no highlight above HIGHLIGHT_FLOOR is a camera firing in a bag. */
export const DARK_CEILING = 0.06
export const HIGHLIGHT_FLOOR = 0.08

export interface TasteMetrics {
  contrast: number
  tonalRange: number
  symmetry: number
  singleness: number
  centeredness: number
  meanLuma: number
  p99Luma: number
  featureless: boolean
}

export interface TasteScored<T> {
  item: T
  metrics: TasteMetrics
  /** z-scored blend across the set; null when the frame was excluded as featureless. */
  ejtaste: number | null
}

/** In-place iterative radix-2 FFT over separate real/imaginary arrays. */
function fft1d(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k]
        const aIm = im[i + k]
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = aRe + bRe
        im[i + k] = aIm + bIm
        re[i + k + len / 2] = aRe - bRe
        im[i + k + len / 2] = aIm - bIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n
      im[i] /= n
    }
  }
}

function fft2d(re: Float64Array, im: Float64Array, size: number, inverse = false): void {
  const rowRe = new Float64Array(size)
  const rowIm = new Float64Array(size)
  for (let y = 0; y < size; y++) {
    rowRe.set(re.subarray(y * size, y * size + size))
    rowIm.set(im.subarray(y * size, y * size + size))
    fft1d(rowRe, rowIm, inverse)
    re.set(rowRe, y * size)
    im.set(rowIm, y * size)
  }
  const colRe = new Float64Array(size)
  const colIm = new Float64Array(size)
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      colRe[y] = re[y * size + x]
      colIm[y] = im[y * size + x]
    }
    fft1d(colRe, colIm, inverse)
    for (let y = 0; y < size; y++) {
      re[y * size + x] = colRe[y]
      im[y * size + x] = colIm[y]
    }
  }
}

function boxBlur(src: Float64Array, size: number, k: number): Float64Array {
  const out = new Float64Array(src.length)
  const half = Math.floor(k / 2)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0
      for (let dy = 0; dy < k; dy++) {
        const sy = Math.min(size - 1, Math.max(0, y + dy - half))
        for (let dx = 0; dx < k; dx++) {
          const sx = Math.min(size - 1, Math.max(0, x + dx - half))
          sum += src[sy * size + sx]
        }
      }
      out[y * size + x] = sum / (k * k)
    }
  }
  return out
}

/** Spectral-residual saliency: what the eye is drawn to. */
export function saliency(gray: Float64Array, size = SAMPLE_SIZE): Float64Array {
  const re = Float64Array.from(gray)
  const im = new Float64Array(gray.length)
  fft2d(re, im, size)

  const logAmp = new Float64Array(gray.length)
  const phase = new Float64Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    logAmp[i] = Math.log1p(Math.hypot(re[i], im[i]))
    phase[i] = Math.atan2(im[i], re[i])
  }
  const avg = boxBlur(logAmp, size, 3)

  for (let i = 0; i < gray.length; i++) {
    const mag = Math.exp(logAmp[i] - avg[i])
    re[i] = mag * Math.cos(phase[i])
    im[i] = mag * Math.sin(phase[i])
  }
  fft2d(re, im, size, true)

  const power = new Float64Array(gray.length)
  for (let i = 0; i < gray.length; i++) power[i] = re[i] * re[i] + im[i] * im[i]
  return boxBlur(power, size, 5)
}

function percentile(values: ArrayLike<number>, p: number): number {
  const sorted = Array.from(values).sort((a, b) => a - b)
  if (!sorted.length) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/** Flood-fill the biggest salient blob; returns its share of salient mass and its centre. */
export function largestBlob(
  mask: Uint8Array,
  size = SAMPLE_SIZE
): { fraction: number; cy: number; cx: number } {
  let total = 0
  for (let i = 0; i < mask.length; i++) total += mask[i]
  if (!total) return { fraction: 0, cy: 0.5, cx: 0.5 }

  const seen = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  let best = 0
  let bestCy = 0.5
  let bestCx = 0.5

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    seen[start] = 1
    let count = 0
    let sumY = 0
    let sumX = 0
    while (head < tail) {
      const idx = queue[head++]
      const y = (idx / size) | 0
      const x = idx % size
      count++
      sumY += y
      sumX += x
      if (y > 0 && mask[idx - size] && !seen[idx - size]) { seen[idx - size] = 1; queue[tail++] = idx - size }
      if (y < size - 1 && mask[idx + size] && !seen[idx + size]) { seen[idx + size] = 1; queue[tail++] = idx + size }
      if (x > 0 && mask[idx - 1] && !seen[idx - 1]) { seen[idx - 1] = 1; queue[tail++] = idx - 1 }
      if (x < size - 1 && mask[idx + 1] && !seen[idx + 1]) { seen[idx + 1] = 1; queue[tail++] = idx + 1 }
    }
    if (count > best) {
      best = count
      bestCy = sumY / count / size
      bestCx = sumX / count / size
    }
  }
  return { fraction: best / total, cy: bestCy, cx: bestCx }
}

/** Metrics for one already-downsampled greyscale frame, values 0..1. */
export function metricsFromGray(gray: Float64Array, size = SAMPLE_SIZE): TasteMetrics {
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  const mean = sum / gray.length

  let varSum = 0
  let absDev = 0
  for (let i = 0; i < gray.length; i++) {
    const d = gray[i] - mean
    varSum += d * d
    absDev += Math.abs(d)
  }
  const contrast = Math.sqrt(varSum / gray.length)
  const meanAbsDev = absDev / gray.length

  let mirrorDiff = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      mirrorDiff += Math.abs(gray[y * size + x] - gray[y * size + (size - 1 - x)])
    }
  }
  const symmetry = 1 - mirrorDiff / gray.length / (meanAbsDev * 2 + 1e-6)

  const p2 = percentile(gray, 2)
  const p98 = percentile(gray, 98)
  const p99 = percentile(gray, 99)

  const sal = saliency(gray, size)
  const thresh = percentile(sal, 92)
  const mask = new Uint8Array(sal.length)
  for (let i = 0; i < sal.length; i++) mask[i] = sal[i] >= thresh ? 1 : 0
  const { fraction, cy, cx } = largestBlob(mask, size)
  const centeredness = 1 - Math.min(1, 2 * Math.hypot(cy - 0.5, cx - 0.5))

  return {
    contrast,
    tonalRange: p98 - p2,
    symmetry,
    singleness: fraction,
    centeredness,
    meanLuma: mean,
    p99Luma: p99,
    featureless: mean < DARK_CEILING && p99 < HIGHLIGHT_FLOOR
  }
}

function zScores(values: number[]): number[] {
  const n = values.length
  if (!n) return []
  const mean = values.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  return values.map(v => (v - mean) / (sd + 1e-9))
}

/**
 * Blend metrics into one score per item, z-scored across the set.
 * Featureless frames are left unscored so they cannot skew the population.
 */
export function blendScores<T>(
  entries: Array<{ item: T; metrics: TasteMetrics }>,
  { dropFeatureless = true } = {}
): Array<TasteScored<T>> {
  const pool = dropFeatureless ? entries.filter(e => !e.metrics.featureless) : entries
  const scores = new Map<TasteMetrics, number>()

  if (pool.length) {
    const zc = zScores(pool.map(e => e.metrics.contrast))
    const zt = zScores(pool.map(e => e.metrics.tonalRange))
    const zs = zScores(pool.map(e => e.metrics.symmetry))
    const zsub = zScores(pool.map(e => e.metrics.singleness * e.metrics.centeredness))
    pool.forEach((e, i) => {
      scores.set(
        e.metrics,
        TASTE_WEIGHTS.contrast * zc[i] +
          TASTE_WEIGHTS.tonalRange * zt[i] +
          TASTE_WEIGHTS.symmetry * zs[i] +
          TASTE_WEIGHTS.subject * zsub[i]
      )
    })
  }

  return entries
    .map(e => ({
      item: e.item,
      metrics: e.metrics,
      ejtaste: scores.has(e.metrics) ? Number(scores.get(e.metrics)!.toFixed(4)) : null
    }))
    .sort((a, b) => (b.ejtaste ?? -Infinity) - (a.ejtaste ?? -Infinity))
}

export function useTasteRanking() {
  /** Downsample any drawable image to a square greyscale buffer via canvas. */
  const toGray = (
    source: CanvasImageSource,
    size = SAMPLE_SIZE
  ): Float64Array => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(source, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    const gray = new Float64Array(size * size)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      // Rec. 601 luma, matching Pillow's "L" conversion
      gray[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    }
    return gray
  }

  const measure = (source: CanvasImageSource, size = SAMPLE_SIZE): TasteMetrics =>
    metricsFromGray(toGray(source, size), size)

  const loadAndMeasure = (url: string, size = SAMPLE_SIZE): Promise<TasteMetrics> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          resolve(measure(img, size))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error(`could not load ${url}`))
      img.src = url
    })

  /** Score a list of photos, best first. */
  const rank = async <T extends { imageUrl: string }>(
    photos: T[],
    { dropFeatureless = true, size = SAMPLE_SIZE } = {}
  ): Promise<Array<TasteScored<T>>> => {
    const entries: Array<{ item: T; metrics: TasteMetrics }> = []
    for (const photo of photos) {
      try {
        entries.push({ item: photo, metrics: await loadAndMeasure(photo.imageUrl, size) })
      } catch {
        // an unreadable frame simply does not compete
      }
    }
    return blendScores(entries, { dropFeatureless })
  }

  return { toGray, measure, loadAndMeasure, rank, blendScores, metricsFromGray, TASTE_WEIGHTS }
}
