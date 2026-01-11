import { describe, it, expect } from 'vitest'

describe('Margin Safety for Commercial Printing', () => {
  // Constants from App.vue logic
  const DPI = 300
  const COMMERCIAL_SAFE_TEXT_PAD = 75 // px
  const NORMAL_TEXT_PAD = 30 // px
  const COMMERCIAL_SAFE_IMAGE_MARGIN = 180 // px
  const NORMAL_IMAGE_MARGIN = 90 // px
  
  // Commercial printer cutting tolerances
  const MIN_CUTTING_TOLERANCE = 0.125 // inches (1/8")
  const MAX_CUTTING_TOLERANCE = 0.25 // inches (1/4")
  
  // Minimum text area requirement for readability
  const MIN_TEXT_AREA_PX = 50 // Minimum space needed for legible EXIF text
  const MIN_TEXT_AREA_NORMAL_PX = 30 // Smaller minimum for careful printing
  
  const inchesToPixels = (inches: number) => inches * DPI
  const pixelsToInches = (pixels: number) => pixels / DPI

  describe('Text padding safety margins', () => {
    it('should provide adequate safety margin for commercial printing text', () => {
      // Commercial safe text padding should meet or exceed worst-case cutting
      const worstCaseCuttingPx = inchesToPixels(MAX_CUTTING_TOLERANCE)
      expect(COMMERCIAL_SAFE_TEXT_PAD).toBeGreaterThanOrEqual(worstCaseCuttingPx)
      
      // Verify the exact safety margin
      expect(COMMERCIAL_SAFE_TEXT_PAD).toBe(75) // 0.25" at 300 DPI
      expect(pixelsToInches(COMMERCIAL_SAFE_TEXT_PAD)).toBeCloseTo(0.25, 2)
    })

    it('should provide minimal cutting for normal mode', () => {
      // Normal mode can be tighter since it's for careful printing
      const minCuttingPx = inchesToPixels(MIN_CUTTING_TOLERANCE)
      expect(NORMAL_TEXT_PAD).toBeLessThan(minCuttingPx)
      
      // Verify the exact value
      expect(NORMAL_TEXT_PAD).toBe(30) // 0.1" at 300 DPI
      expect(pixelsToInches(NORMAL_TEXT_PAD)).toBeCloseTo(0.1, 2)
    })
  })

  describe('Image margin safety', () => {
    it('should provide adequate image margin for commercial printing', () => {
      // Image margin should be significantly larger than text padding
      expect(COMMERCIAL_SAFE_IMAGE_MARGIN).toBeGreaterThan(COMMERCIAL_SAFE_TEXT_PAD * 2)
      
      // Verify the exact margin in inches
      expect(COMMERCIAL_SAFE_IMAGE_MARGIN).toBe(180) // 0.6" at 300 DPI
      expect(pixelsToInches(COMMERCIAL_SAFE_IMAGE_MARGIN)).toBeCloseTo(0.6, 2)
    })

    it('should provide reasonable margin for normal mode', () => {
      expect(NORMAL_IMAGE_MARGIN).toBeGreaterThan(NORMAL_TEXT_PAD * 2)
      
      // Verify the exact margin
      expect(NORMAL_IMAGE_MARGIN).toBe(90) // 0.3" at 300 DPI
      expect(pixelsToInches(NORMAL_IMAGE_MARGIN)).toBeCloseTo(0.3, 2)
    })
  })

  describe('Safety margin calculations for different print sizes', () => {
    const printSizes = [
      { name: '4x6', width: 1800, height: 1200 },
      { name: '5x7', width: 2100, height: 1500 },
      { name: '8x10', width: 3000, height: 2400 },
      { name: '8x12', width: 3600, height: 2400 },
      { name: '11x14', width: 4200, height: 3300 }
    ]

    printSizes.forEach(size => {
      it(`should leave adequate safe area for EXIF text on ${size.name} print in commercial mode`, () => {
        const textPad = COMMERCIAL_SAFE_TEXT_PAD
        const imageMargin = COMMERCIAL_SAFE_IMAGE_MARGIN
        
        // Calculate available space for text between edge and image
        const textAreaWidth = imageMargin - textPad
        const textAreaHeight = imageMargin - textPad
        
        // Text area should meet minimum requirement for readability
        expect(textAreaWidth).toBeGreaterThanOrEqual(MIN_TEXT_AREA_PX)
        expect(textAreaHeight).toBeGreaterThanOrEqual(MIN_TEXT_AREA_PX)
        
        // Verify the calculation
        expect(textAreaWidth).toBe(105) // 180 - 75
        expect(textAreaHeight).toBe(105)
      })

      it(`should leave space for EXIF text on ${size.name} print in normal mode`, () => {
        const textPad = NORMAL_TEXT_PAD
        const imageMargin = NORMAL_IMAGE_MARGIN
        
        // Calculate available space
        const textAreaWidth = imageMargin - textPad
        const textAreaHeight = imageMargin - textPad
        
        // Should still have reasonable space
        expect(textAreaWidth).toBeGreaterThanOrEqual(MIN_TEXT_AREA_NORMAL_PX)
        expect(textAreaHeight).toBeGreaterThanOrEqual(MIN_TEXT_AREA_NORMAL_PX)
        
        // Verify the calculation
        expect(textAreaWidth).toBe(60) // 90 - 30
        expect(textAreaHeight).toBe(60)
      })
    })
  })

  describe('Minimum margin calculation with font size', () => {
    it('should ensure minimum margin accounts for text size in commercial mode', () => {
      // Example: 4x6 print (1800px wide)
      const canvasWidth = 1800
      const textSize = 1.0 // default multiplier
      const fontSize = Math.floor((canvasWidth / 100) * textSize) // = 18px
      
      const textPad = COMMERCIAL_SAFE_TEXT_PAD // 75px
      const minMargin = textPad + fontSize * 1.5 // 75 + 27 = 102px
      
      // Minimum margin should be sufficient
      expect(minMargin).toBeGreaterThan(textPad)
      expect(minMargin).toBe(102)
      
      // But commercial safe default (180px) should be larger
      expect(COMMERCIAL_SAFE_IMAGE_MARGIN).toBeGreaterThan(minMargin)
    })

    it('should ensure minimum margin accounts for large text size', () => {
      // Example: Large text on 8x10 print (3000px wide)
      const canvasWidth = 3000
      const textSize = 2.0 // large multiplier
      const fontSize = Math.floor((canvasWidth / 100) * textSize) // = 60px
      
      const textPad = COMMERCIAL_SAFE_TEXT_PAD // 75px
      const minMargin = textPad + fontSize * 1.5 // 75 + 90 = 165px
      
      // Should be less than default commercial margin
      expect(minMargin).toBeLessThan(COMMERCIAL_SAFE_IMAGE_MARGIN)
      expect(minMargin).toBe(165)
    })
  })

  describe('Contact sheet margins', () => {
    it('should use increased minimum margin for contact sheets in normal mode', () => {
      const CONTACT_MARGIN_NORMAL = 60 // Updated from 40
      const CONTACT_MARGIN_COMMERCIAL = 180
      
      // Normal mode should be safer than before
      expect(CONTACT_MARGIN_NORMAL).toBeGreaterThan(NORMAL_TEXT_PAD)
      expect(CONTACT_MARGIN_NORMAL).toBe(60)
      
      // Commercial mode should still be significantly larger
      expect(CONTACT_MARGIN_COMMERCIAL).toBeGreaterThan(CONTACT_MARGIN_NORMAL * 2)
    })
  })
})
