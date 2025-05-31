import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePhotoProcessing } from '../usePhotoProcessing'

// Mock exifr
vi.mock('exifr', () => ({
  default: {
    parse: vi.fn()
  }
}))

// Mock URL.createObjectURL
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url')
  }
})

describe('usePhotoProcessing', () => {
  const { createPhotoFromExif, isImageFile, processPhoto } = usePhotoProcessing()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPhotoFromExif', () => {
    it('should create a photo with default values when exif is empty', () => {
      const photo = createPhotoFromExif({}, 'test.jpg', 'blob:test-url')
      
      expect(photo).toMatchObject({
        name: 'test.jpg',
        imageUrl: 'blob:test-url',
        exif: {
          Make: 'Unknown',
          Model: 'Camera',
          FocalLength: '50',
          FNumber: '5.6',
          ExposureTime: '1/60',
          ISO: '400'
        }
      })
      expect(photo.id).toBeTypeOf('number')
    })

    it('should use provided exif data when available', () => {
      const mockExif = {
        Make: 'Canon',
        Model: 'EOS R5',
        FocalLength: '85',
        FNumber: '1.4',
        ExposureTime: '1/125',
        ISO: '800',
        DateTimeOriginal: '2024-01-01T12:00:00',
        LensModel: 'RF 85mm f/1.2L USM'
      }

      const photo = createPhotoFromExif(mockExif, 'canon.jpg', 'blob:canon-url')
      
      expect(photo.exif).toMatchObject({
        Make: 'Canon',
        Model: 'EOS R5',
        FocalLength: '85',
        FNumber: '1.4',
        ExposureTime: '1/125',
        ISO: '800',
        DateTimeOriginal: '2024-01-01T12:00:00',
        LensModel: 'RF 85mm f/1.2L USM'
      })
    })

    it('should include filePath when provided', () => {
      const photo = createPhotoFromExif({}, 'test.jpg', 'blob:test-url', '/path/to/test.jpg')
      expect(photo.filePath).toBe('/path/to/test.jpg')
    })

    it('should handle ISO from both ISO and ISOSpeedRatings fields', () => {
      const exifWithISOSpeedRatings = { ISOSpeedRatings: '1600' }
      const photo1 = createPhotoFromExif(exifWithISOSpeedRatings, 'test1.jpg', 'blob:test1')
      expect(photo1.exif.ISO).toBe('1600')

      const exifWithISO = { ISO: '3200' }
      const photo2 = createPhotoFromExif(exifWithISO, 'test2.jpg', 'blob:test2')
      expect(photo2.exif.ISO).toBe('3200')
    })
  })

  describe('isImageFile', () => {
    it('should return true for supported image extensions', () => {
      const validExtensions = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp']
      
      validExtensions.forEach(ext => {
        expect(isImageFile(`photo.${ext}`)).toBe(true)
        expect(isImageFile(`photo.${ext.toUpperCase()}`)).toBe(true)
      })
    })

    it('should return false for unsupported extensions', () => {
      const invalidExtensions = ['txt', 'pdf', 'doc', 'mp4', 'gif']
      
      invalidExtensions.forEach(ext => {
        expect(isImageFile(`file.${ext}`)).toBe(false)
      })
    })

    it('should handle files without extensions', () => {
      expect(isImageFile('filename')).toBe(false)
    })

    it('should handle complex file paths', () => {
      expect(isImageFile('/path/to/photo.jpg')).toBe(true)
      expect(isImageFile('C:\\\\Users\\\\photos\\\\image.PNG')).toBe(true)
    })
  })

  describe('processPhoto', () => {
    it('should process a File object with exif data', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.default.parse).mockResolvedValue({
        Make: 'Sony',
        Model: 'A7R IV',
        FocalLength: '24'
      })

      const mockFile = new File(['fake image data'], 'sony.jpg', { type: 'image/jpeg' })
      
      const photo = await processPhoto(mockFile)
      
      expect(photo.name).toBe('sony.jpg')
      expect(photo.file).toBe(mockFile)
      expect(photo.exif.Make).toBe('Sony')
      expect(photo.exif.Model).toBe('A7R IV')
      expect(photo.exif.FocalLength).toBe('24')
      expect(exifr.default.parse).toHaveBeenCalledWith(mockFile)
    })

    it('should handle files with no exif data', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.default.parse).mockResolvedValue(null)

      const mockFile = new File(['fake image data'], 'no-exif.jpg', { type: 'image/jpeg' })
      
      const photo = await processPhoto(mockFile)
      
      expect(photo.exif.Make).toBe('Unknown')
      expect(photo.exif.Model).toBe('Camera')
    })

    it('should handle exif parsing errors gracefully', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.default.parse).mockRejectedValue(new Error('Parsing failed'))

      const mockFile = new File(['corrupted data'], 'corrupted.jpg', { type: 'image/jpeg' })
      
      await expect(processPhoto(mockFile)).rejects.toThrow('Parsing failed')
    })
  })
})