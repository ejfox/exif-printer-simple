/**
 * Near-duplicate collapsing for burst shooting.
 *
 * Two frames are the same shot only if they are close in time AND look alike. Time alone
 * is a poor signal: someone shooting steadily while walking produces short gaps between
 * genuinely different photographs, and a time-only rule collapses most of a card.
 *
 * Frames are compared against the burst's first frame rather than the previous one, so a
 * long sequence cannot drift into one cluster. A second pass catches same-day look-alikes
 * outside the time window; it is deliberately same-day only, because across different days
 * frames at this hash distance are coincidentally similar compositions, not duplicates.
 */

export const DEFAULT_WITHIN_SECONDS = 30
export const DEFAULT_HASH_DISTANCE = 10

export interface DedupeCandidate {
  id: string
  /** Perceptual hash, 64 bits. */
  hash: bigint
  /** Capture time. Frames without one are passed through untouched. */
  takenAt: Date | null
  /** Higher wins within a burst. */
  score: number
  /** Used by the same-day pass; derived from takenAt when absent. */
  day?: string
}

export interface DedupeResult<T> {
  keeper: T
  burstSize: number
  others: T[]
}

/** Difference hash: 9x8 greyscale, each pixel compared with its right neighbour. */
export function dhashFromGray(gray: ArrayLike<number>, width = 9, height = 8): bigint {
  let hash = 0n
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = gray[y * width + x]
      const right = gray[y * width + x + 1]
      hash = (hash << 1n) | (right > left ? 1n : 0n)
    }
  }
  return hash
}

export function hamming(a: bigint, b: bigint): number {
  let diff = a ^ b
  let count = 0
  while (diff) {
    diff &= diff - 1n
    count++
  }
  return count
}

function dayOf(c: DedupeCandidate): string {
  if (c.day) return c.day
  return c.takenAt ? c.takenAt.toISOString().slice(0, 10) : ''
}

/**
 * Group frames into bursts and keep the best of each.
 * Returns keepers best-score-first, each with the frames it stood in for.
 */
export function collapseDuplicates<T extends DedupeCandidate>(
  candidates: T[],
  {
    withinSeconds = DEFAULT_WITHIN_SECONDS,
    hashDistance = DEFAULT_HASH_DISTANCE,
    sameDaySecondPass = true
  } = {}
): Array<DedupeResult<T>> {
  const timed = candidates.filter(c => c.takenAt instanceof Date && !isNaN(c.takenAt.valueOf()))
  const untimed = candidates.filter(c => !timed.includes(c))
  if (!timed.length) {
    return candidates.map(c => ({ keeper: c, burstSize: 1, others: [] }))
  }

  const seq = [...timed].sort((a, b) => a.takenAt!.valueOf() - b.takenAt!.valueOf())
  const clusters: T[][] = [[seq[0]]]
  let anchor = seq[0]

  for (let i = 1; i < seq.length; i++) {
    const cur = seq[i]
    const prev = seq[i - 1]
    const gap = (cur.takenAt!.valueOf() - prev.takenAt!.valueOf()) / 1000
    if (gap <= withinSeconds && hamming(cur.hash, anchor.hash) <= hashDistance) {
      clusters[clusters.length - 1].push(cur)
    } else {
      clusters.push([cur])
      anchor = cur
    }
  }

  let keepers: Array<DedupeResult<T>> = clusters.map(cluster => {
    const keeper = cluster.reduce((best, c) => (c.score > best.score ? c : best), cluster[0])
    return {
      keeper,
      burstSize: cluster.length,
      others: cluster.filter(c => c !== keeper)
    }
  })
  keepers.sort((a, b) => b.keeper.score - a.keeper.score)

  if (sameDaySecondPass) {
    const survivors: Array<DedupeResult<T>> = []
    for (const entry of keepers) {
      const day = dayOf(entry.keeper)
      const clash = survivors.find(
        s => dayOf(s.keeper) === day && hamming(s.keeper.hash, entry.keeper.hash) <= hashDistance
      )
      if (clash) {
        clash.others = [...clash.others, entry.keeper, ...entry.others]
        clash.burstSize += entry.burstSize
        continue
      }
      survivors.push(entry)
    }
    keepers = survivors
  }

  for (const c of untimed) keepers.push({ keeper: c, burstSize: 1, others: [] })
  return keepers
}

export function useDedupe() {
  /** Hash any drawable image via canvas, for use with collapseDuplicates. */
  const hashImage = (source: CanvasImageSource): bigint => {
    const canvas = document.createElement('canvas')
    canvas.width = 9
    canvas.height = 8
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(source, 0, 0, 9, 8)
    const { data } = ctx.getImageData(0, 0, 9, 8)
    const gray = new Float64Array(72)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    }
    return dhashFromGray(gray)
  }

  const hashUrl = (url: string): Promise<bigint> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          resolve(hashImage(img))
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error(`could not load ${url}`))
      img.src = url
    })

  return { hashImage, hashUrl, dhashFromGray, hamming, collapseDuplicates }
}
