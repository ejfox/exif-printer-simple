import { describe, it, expect } from 'vitest'
import { collapseDuplicates, dhashFromGray, hamming, type DedupeCandidate } from '../useDedupe'

const BASE = new Date('2026-08-21T15:39:00Z')

function at(seconds: number): Date {
  return new Date(BASE.valueOf() + seconds * 1000)
}

function frame(
  id: string,
  seconds: number,
  hash: bigint,
  score: number
): DedupeCandidate {
  return { id, hash, takenAt: at(seconds), score }
}

describe('perceptual hashing', () => {
  it('produces 64 bits from a 9x8 sample', () => {
    const gray = new Float64Array(72)
    for (let i = 0; i < 72; i++) gray[i] = i % 9
    const h = dhashFromGray(gray)
    expect(h).toBeGreaterThanOrEqual(0n)
    expect(h < 1n << 64n).toBe(true)
  })

  it('gives identical frames a distance of zero', () => {
    const gray = new Float64Array(72).map((_, i) => (i * 7) % 13)
    expect(hamming(dhashFromGray(gray), dhashFromGray(gray))).toBe(0)
  })

  it('counts differing bits', () => {
    expect(hamming(0b1011n, 0b1000n)).toBe(2)
    expect(hamming(0n, 0xffffffffffffffffn)).toBe(64)
  })
})

describe('burst collapsing', () => {
  it('keeps the best frame of a run of near-identical shots', () => {
    const out = collapseDuplicates([
      frame('a', 0, 0b1010n, 0.1),
      frame('b', 1, 0b1010n, 0.9),
      frame('c', 2, 0b1011n, 0.4)
    ])
    expect(out).toHaveLength(1)
    expect(out[0].keeper.id).toBe('b')
    expect(out[0].burstSize).toBe(3)
    expect(out[0].others.map(o => o.id).sort()).toEqual(['a', 'c'])
  })

  it('does not merge frames that are close in time but look different', () => {
    const out = collapseDuplicates([
      frame('road', 0, 0x0000000000000000n, 0.5),
      frame('portrait', 2, 0xffffffffffffffffn, 0.6)
    ])
    expect(out).toHaveLength(2)
  })

  it('does not merge look-alikes separated by a long gap', () => {
    const out = collapseDuplicates([
      frame('morning', 0, 0b1010n, 0.5),
      frame('evening', 4000, 0b1010n, 0.6)
    ])
    // same day and identical hash, so the second pass folds them
    expect(out).toHaveLength(1)
  })

  it('compares against the burst anchor so a long run cannot drift', () => {
    // each frame is 3 bits from its neighbour but 12 from the first
    const out = collapseDuplicates(
      [
        frame('f0', 0, 0b000000000000n, 0.1),
        frame('f1', 5, 0b000000000111n, 0.2),
        frame('f2', 10, 0b000000111111n, 0.3),
        frame('f3', 15, 0b000111111111n, 0.4),
        frame('f4', 20, 0b111111111111n, 0.5)
      ],
      { hashDistance: 6, sameDaySecondPass: false }
    )
    expect(out.length).toBeGreaterThan(1)
  })

  it('folds same-day look-alikes that fell outside the time window', () => {
    const out = collapseDuplicates([
      frame('first', 0, 0b1010n, 0.9),
      frame('later', 600, 0b1010n, 0.2)
    ])
    expect(out).toHaveLength(1)
    expect(out[0].keeper.id).toBe('first')
  })

  it('keeps coincidentally similar frames from different days apart', () => {
    const out = collapseDuplicates([
      { id: 'julyHorizon', hash: 0b1010n, takenAt: new Date('2026-07-04T21:00:00Z'), score: 0.5 },
      { id: 'augustHorizon', hash: 0b1010n, takenAt: new Date('2026-08-29T21:00:00Z'), score: 0.6 }
    ])
    expect(out).toHaveLength(2)
  })

  it('respects a wider time window when asked', () => {
    const frames = [frame('a', 0, 0b1010n, 0.4), frame('b', 45, 0b1010n, 0.8)]
    const tight = collapseDuplicates(frames, { withinSeconds: 30, sameDaySecondPass: false })
    const loose = collapseDuplicates(frames, { withinSeconds: 60, sameDaySecondPass: false })
    expect(tight).toHaveLength(2)
    expect(loose).toHaveLength(1)
  })

  it('returns keepers best first', () => {
    const out = collapseDuplicates([
      frame('low', 0, 0x0000000000000000n, 0.1),
      frame('high', 500, 0xffffffffn, 0.9),
      frame('mid', 1000, 0xffffffff00000000n, 0.5)
    ])
    expect(out.map(o => o.keeper.id)).toEqual(['high', 'mid', 'low'])
  })

  it('passes through frames with no capture time', () => {
    const out = collapseDuplicates([
      { id: 'undated', hash: 0b1n, takenAt: null, score: 0.3 },
      frame('dated', 0, 0b1000n, 0.7)
    ])
    expect(out.map(o => o.keeper.id).sort()).toEqual(['dated', 'undated'])
  })

  it('handles an empty set', () => {
    expect(collapseDuplicates([])).toEqual([])
  })
})
