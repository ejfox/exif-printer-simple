import { describe, it, expect } from 'vitest'
import { usePrintSizes } from '../usePrintSizes'

describe('usePrintSizes', () => {
  const { getSizeConfig, getAspectRatio, isSquare, getAllSizes } = usePrintSizes()

  describe('getSizeConfig', () => {
    it('should return correct dimensions for all print sizes', () => {
      expect(getSizeConfig('4x6')).toEqual({ width: 1800, height: 1200 })
      expect(getSizeConfig('5x7')).toEqual({ width: 2100, height: 1500 })
      expect(getSizeConfig('8x10')).toEqual({ width: 3000, height: 2400 })
      expect(getSizeConfig('8x12')).toEqual({ width: 3600, height: 2400 })
      expect(getSizeConfig('11x14')).toEqual({ width: 4200, height: 3300 })
      expect(getSizeConfig('square')).toEqual({ width: 1500, height: 1500 })
    })

    it('should return default 4x6 for invalid size', () => {
      // @ts-expect-error Testing invalid input
      expect(getSizeConfig('invalid')).toEqual({ width: 1800, height: 1200 })
    })
  })

  describe('getAspectRatio', () => {
    it('should calculate correct aspect ratios', () => {
      expect(getAspectRatio('4x6')).toBe(1.5) // 1800/1200
      expect(getAspectRatio('5x7')).toBe(1.4) // 2100/1500
      expect(getAspectRatio('8x10')).toBe(1.25) // 3000/2400
      expect(getAspectRatio('8x12')).toBe(1.5) // 3600/2400
      expect(getAspectRatio('11x14')).toBeCloseTo(1.273) // 4200/3300
      expect(getAspectRatio('square')).toBe(1) // 1500/1500
    })
  })

  describe('isSquare', () => {
    it('should return true only for square format', () => {
      expect(isSquare('square')).toBe(true)
      expect(isSquare('4x6')).toBe(false)
      expect(isSquare('5x7')).toBe(false)
      expect(isSquare('8x10')).toBe(false)
      expect(isSquare('8x12')).toBe(false)
      expect(isSquare('11x14')).toBe(false)
    })
  })

  describe('getAllSizes', () => {
    it('should return all available sizes', () => {
      const allSizes = getAllSizes()
      expect(Object.keys(allSizes)).toHaveLength(6)
      expect(allSizes).toHaveProperty('4x6')
      expect(allSizes).toHaveProperty('5x7')
      expect(allSizes).toHaveProperty('8x10')
      expect(allSizes).toHaveProperty('8x12')
      expect(allSizes).toHaveProperty('11x14')
      expect(allSizes).toHaveProperty('square')
    })

    it('should return a copy of sizes (not reference)', () => {
      const allSizes = getAllSizes()
      allSizes['4x6'].width = 9999
      
      // Original should be unchanged
      expect(getSizeConfig('4x6').width).toBe(1800)
    })
  })
})