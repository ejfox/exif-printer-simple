import exifr from 'exifr'
import { invoke } from '@tauri-apps/api/core'

export interface PhotoExif {
  Make: string
  Model: string
  FocalLength: string
  FNumber: string
  ExposureTime: string
  ISO: string
  DateTimeOriginal: string
  LensModel?: string
  WhiteBalance?: string
  ExposureMode?: string
  ExposureProgram?: string
  MeteringMode?: string
  Flash?: string
}

export interface Photo {
  id: number
  name: string
  filePath?: string
  imageUrl: string
  file?: File
  exif: PhotoExif
}

export function usePhotoProcessing() {
  const createPhotoFromExif = (
    exif: any, 
    name: string, 
    imageUrl: string, 
    filePath?: string
  ): Photo => {
    return {
      id: Date.now() + Math.random(),
      name,
      filePath,
      imageUrl,
      exif: {
        Make: exif.Make || 'Unknown',
        Model: exif.Model || 'Camera',
        FocalLength: exif.FocalLength || '50',
        FNumber: exif.FNumber || '5.6',
        ExposureTime: exif.ExposureTime || '1/60',
        ISO: exif.ISO || exif.ISOSpeedRatings || '400',
        DateTimeOriginal: exif.DateTimeOriginal || new Date().toISOString().split('T')[0],
        LensModel: exif.LensModel || exif.LensMake,
        WhiteBalance: exif.WhiteBalance,
        ExposureMode: exif.ExposureMode,
        ExposureProgram: exif.ExposureProgram,
        MeteringMode: exif.MeteringMode,
        Flash: exif.Flash
      }
    }
  }

  const processPhoto = async (file: File): Promise<Photo> => {
    const exif = await exifr.parse(file) || {}
    const imageUrl = URL.createObjectURL(file)
    const photo = createPhotoFromExif(exif, file.name, imageUrl)
    photo.file = file
    return photo
  }

  const processPhotoFromPath = async (filePath: string): Promise<Photo | null> => {
    try {
      const fileBytes = await invoke('read_file_as_bytes', { filePath })
      const blob = new Blob([new Uint8Array(fileBytes as number[])])
      const imageUrl = URL.createObjectURL(blob)
      const exif = await exifr.parse(blob) || {}
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || ''
      
      return createPhotoFromExif(exif, fileName, imageUrl, filePath)
    } catch (error) {
      console.error('Error processing photo from path:', error)
      return null
    }
  }

  const isImageFile = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp', 'webp'].includes(ext || '')
  }

  return {
    createPhotoFromExif,
    processPhoto,
    processPhotoFromPath,
    isImageFile
  }
}