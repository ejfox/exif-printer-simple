import { describe, it, expect } from 'vitest'
import { useContactSheet } from '../useContactSheet'

const { calculateGrid, paginate, sheetCapacity, formatExif } = useContactSheet()

describe('grid selection', () => {
  it('keeps the original layouts', () => {
    expect(calculateGrid(4)).toEqual({ cols: 3, rows: 2 })
    expect(calculateGrid(12)).toEqual({ cols: 4, rows: 3 })
    expect(calculateGrid(20)).toEqual({ cols: 5, rows: 4 })
    expect(calculateGrid(30)).toEqual({ cols: 6, rows: 5 })
    expect(calculateGrid(42)).toEqual({ cols: 7, rows: 6 })
    expect(calculateGrid(500)).toEqual({ cols: 8, rows: 7 })
  })
})

describe('pagination', () => {
  it('fits a small set on one sheet', () => {
    expect(paginate(Array.from({ length: 10 }, (_, i) => i))).toHaveLength(1)
  })

  it('splits a large set instead of dropping the overflow', () => {
    const pages = paginate(Array.from({ length: 250 }, (_, i) => i))
    expect(pages.length).toBe(Math.ceil(250 / sheetCapacity()))
    expect(pages.flat()).toHaveLength(250)
  })

  it('honours an explicit sheet size', () => {
    const pages = paginate(Array.from({ length: 9 }, (_, i) => i), 4)
    expect(pages.map(p => p.length)).toEqual([4, 4, 1])
  })

  it('returns one empty page for no photos', () => {
    expect(paginate([])).toEqual([[]])
  })
})

describe('exif formatting', () => {
  it('abbreviates camera settings', () => {
    expect(formatExif({ FocalLength: 35, FNumber: 2, ExposureTime: 0.008, ISO: 800 }))
      .toBe('35mm f/2 1/125 800')
  })

  it('writes long exposures in seconds', () => {
    expect(formatExif({ ExposureTime: 4 })).toBe('4s')
  })

  it('skips missing fields', () => {
    expect(formatExif({ ISO: 400 })).toBe('400')
    expect(formatExif({})).toBe('')
  })
})
