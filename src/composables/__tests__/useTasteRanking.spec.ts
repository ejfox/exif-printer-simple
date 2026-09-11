import { describe, it, expect } from 'vitest'
import {
  metricsFromGray,
  blendScores,
  largestBlob,
  saliency,
  TASTE_WEIGHTS,
  SAMPLE_SIZE,
  type TasteMetrics
} from '../useTasteRanking'

const SIZE = SAMPLE_SIZE

/** The same deterministic frame the Python reference was measured on. */
function syntheticFrame(): Float64Array {
  const gray = new Float64Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = 0.5 + 0.35 * Math.sin(x / 11) * Math.cos(y / 17)
      // Float32 rounding, matching the numpy reference's dtype
      gray[y * SIZE + x] = Math.fround(Math.min(1, Math.max(0, v)))
    }
  }
  return gray
}

function flat(value: number): Float64Array {
  return new Float64Array(SIZE * SIZE).fill(value)
}

function metricsFor(overrides: Partial<TasteMetrics> = {}): TasteMetrics {
  return {
    contrast: 0.2,
    tonalRange: 0.5,
    symmetry: 0.5,
    singleness: 0.4,
    centeredness: 0.5,
    meanLuma: 0.5,
    p99Luma: 0.9,
    featureless: false,
    ...overrides
  }
}

describe('EJ-taste metrics', () => {
  // These expected values come from the Python implementation in mcp/ejprint.py,
  // measured on the identical synthetic frame. They are the parity contract between
  // the in-app ranker and the MCP server: if a change breaks these, the two have drifted.
  const gray = syntheticFrame()
  const m = metricsFromGray(gray)

  it('matches the Python reference for contrast', () => {
    expect(m.contrast).toBeCloseTo(0.170984, 4)
  })

  it('matches the Python reference for tonal range', () => {
    expect(m.tonalRange).toBeCloseTo(0.651719, 4)
  })

  it('matches the Python reference for symmetry', () => {
    expect(m.symmetry).toBeCloseTo(0.419183, 3)
  })

  it('matches the Python reference for subject placement', () => {
    expect(m.singleness).toBeCloseTo(0.382224, 2)
    expect(m.centeredness).toBeCloseTo(0.123242, 2)
  })

  it('matches the Python reference for luma summaries', () => {
    expect(m.meanLuma).toBeCloseTo(0.500872, 4)
    expect(m.p99Luma).toBeCloseTo(0.838126, 4)
  })

  it('reports a flat frame as having no contrast and perfect symmetry', () => {
    const f = metricsFromGray(flat(0.5))
    expect(f.contrast).toBeCloseTo(0, 6)
    expect(f.tonalRange).toBeCloseTo(0, 6)
    expect(f.symmetry).toBeGreaterThan(0.99)
  })
})

describe('featureless detection', () => {
  it('flags a frame that is dark with no highlights as a bag shot', () => {
    expect(metricsFromGray(flat(0.01)).featureless).toBe(true)
  })

  it('keeps a dark frame that still has highlights, such as fireworks at night', () => {
    const gray = flat(0.01)
    // A burst against a dark sky, sized to land in the window the filter has to get
    // right: over one percent of the frame so the 99th percentile sees it, but small
    // enough that the frame is still dark on average. Roughly three percent.
    for (let i = 0; i < gray.length; i++) {
      const y = Math.floor(i / SIZE)
      const x = i % SIZE
      if (Math.hypot(y - 128, x - 128) < 25) gray[i] = 0.95
    }
    const m = metricsFromGray(gray)
    expect(m.meanLuma).toBeLessThan(0.06)
    expect(m.featureless).toBe(false)
  })
})

describe('saliency and blob finding', () => {
  it('returns one value per pixel', () => {
    expect(saliency(flat(0.5)).length).toBe(SIZE * SIZE)
  })

  it('finds a single centred blob and reports it as centred', () => {
    const mask = new Uint8Array(SIZE * SIZE)
    for (let y = 120; y < 136; y++) for (let x = 120; x < 136; x++) mask[y * SIZE + x] = 1
    const { fraction, cy, cx } = largestBlob(mask)
    expect(fraction).toBeCloseTo(1, 5)
    expect(cy).toBeCloseTo(0.5, 1)
    expect(cx).toBeCloseTo(0.5, 1)
  })

  it('reports the larger of two blobs as holding part of the salient mass', () => {
    const mask = new Uint8Array(SIZE * SIZE)
    for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) mask[y * SIZE + x] = 1
    for (let y = 200; y < 210; y++) for (let x = 200; x < 210; x++) mask[y * SIZE + x] = 1
    const { fraction } = largestBlob(mask)
    expect(fraction).toBeCloseTo(400 / 500, 5)
  })

  it('handles an empty mask without dividing by zero', () => {
    const { fraction, cy, cx } = largestBlob(new Uint8Array(SIZE * SIZE))
    expect(fraction).toBe(0)
    expect(cy).toBe(0.5)
    expect(cx).toBe(0.5)
  })
})

describe('score blending', () => {
  it('uses the published weights and sums to one', () => {
    const total =
      TASTE_WEIGHTS.contrast +
      TASTE_WEIGHTS.tonalRange +
      TASTE_WEIGHTS.symmetry +
      TASTE_WEIGHTS.subject
    expect(total).toBeCloseTo(1, 6)
  })

  it('ranks the higher-contrast frame above the flatter one', () => {
    const entries = [
      { item: 'flat', metrics: metricsFor({ contrast: 0.05 }) },
      { item: 'punchy', metrics: metricsFor({ contrast: 0.35 }) }
    ]
    const [first] = blendScores(entries)
    expect(first.item).toBe('punchy')
  })

  it('leaves featureless frames unscored and sorts them last', () => {
    const entries = [
      { item: 'bag', metrics: metricsFor({ featureless: true }) },
      { item: 'real', metrics: metricsFor({ contrast: 0.3 }) },
      { item: 'other', metrics: metricsFor({ contrast: 0.1 }) }
    ]
    const out = blendScores(entries)
    expect(out[out.length - 1].item).toBe('bag')
    expect(out[out.length - 1].ejtaste).toBeNull()
    expect(out.filter(o => o.ejtaste !== null)).toHaveLength(2)
  })

  it('does not let excluded frames skew the population', () => {
    const good = [
      { item: 'a', metrics: metricsFor({ contrast: 0.2 }) },
      { item: 'b', metrics: metricsFor({ contrast: 0.4 }) }
    ]
    const withBag = [
      ...good,
      { item: 'bag', metrics: metricsFor({ contrast: 0.001, featureless: true }) }
    ]
    const scoreOf = (rows: ReturnType<typeof blendScores>, id: string) =>
      rows.find(r => r.item === id)!.ejtaste
    expect(scoreOf(blendScores(withBag), 'a')).toBeCloseTo(scoreOf(blendScores(good), 'a')!, 6)
  })

  it('returns an empty list for no input', () => {
    expect(blendScores([])).toEqual([])
  })
})
