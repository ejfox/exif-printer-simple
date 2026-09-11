interface Photo {
  id: string
  name: string
  imageUrl: string
  exif: any
  /** Optional EJ-taste score; when present it can be printed beside the frame. */
  ejtaste?: number | null
}

export interface ContactSheetOptions {
  showFilenames: boolean
  showExif: boolean
  margin: number
  spacing: number
  fontSize: number
  /** Print a running number beside each frame. */
  showRank?: boolean
  /** Where numbering starts, so paged sheets stay continuous. */
  rankOffset?: number
  /** 'light' keeps the original paper look; 'dark' matches the proof-sheet style. */
  theme?: 'light' | 'dark'
  /** Optional heading; defaults to the image count. */
  title?: string
}

const DEFAULTS: ContactSheetOptions = {
  showFilenames: true,
  showExif: true,
  margin: 20,
  spacing: 8,
  fontSize: 8
}

const THEMES = {
  light: { bg: '#ffffff', ink: '#1a1a1a', label: '#374151', muted: '#9ca3af', rule: '#e5e7eb', accent: '#e60067' },
  dark: { bg: '#0a0a0a', ink: '#e8e8e8', label: '#e8e8e8', muted: '#737373', rule: '#2a2a2a', accent: '#e60067' }
} as const

export function useContactSheet() {
  const calculateGrid = (totalPhotos: number) => {
    // Optimal grid layouts for different photo counts
    if (totalPhotos <= 6) return { cols: 3, rows: 2 }
    if (totalPhotos <= 12) return { cols: 4, rows: 3 }
    if (totalPhotos <= 20) return { cols: 5, rows: 4 }
    if (totalPhotos <= 30) return { cols: 6, rows: 5 }
    if (totalPhotos <= 42) return { cols: 7, rows: 6 }
    return { cols: 8, rows: 7 } // Max 56 photos per sheet
  }

  /** How many photos one sheet holds at the grid chosen for that count. */
  const sheetCapacity = (perSheet?: number) => {
    if (perSheet && perSheet > 0) return perSheet
    const { cols, rows } = calculateGrid(Number.MAX_SAFE_INTEGER)
    return cols * rows
  }

  /**
   * Split a set into sheet-sized pages. The original composable silently dropped
   * anything past the first 56 frames; paginate lets a caller render all of them.
   */
  const paginate = <T>(photos: T[], perSheet?: number): T[][] => {
    const size = sheetCapacity(perSheet)
    const pages: T[][] = []
    for (let i = 0; i < photos.length; i += size) pages.push(photos.slice(i, i + size))
    return pages.length ? pages : [[]]
  }

  const formatExif = (exif: any): string => {
    const settings: string[] = []
    if (exif.FocalLength) settings.push(`${exif.FocalLength}mm`)
    if (exif.FNumber) settings.push(`f/${exif.FNumber}`)
    if (exif.ExposureTime) {
      const speed = parseFloat(exif.ExposureTime)
      settings.push(speed >= 1 ? `${speed}s` : `1/${Math.round(1 / speed)}`)
    }
    if (exif.ISO) settings.push(String(exif.ISO))
    return settings.join(' ')
  }

  const generateContactSheet = async (
    canvas: HTMLCanvasElement,
    photos: Photo[],
    options: Partial<ContactSheetOptions> = DEFAULTS
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const opts: ContactSheetOptions = { ...DEFAULTS, ...options }
    const { margin, spacing, fontSize, showFilenames, showExif, showRank, rankOffset = 0 } = opts
    const palette = THEMES[opts.theme ?? 'light']
    const { cols, rows } = calculateGrid(photos.length)

    ctx.fillStyle = palette.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = palette.ink
    ctx.font = `${fontSize + 2}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(opts.title ?? `CONTACT SHEET — ${photos.length} IMAGES`, margin, margin - 8)

    ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillStyle = palette.muted
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    ctx.fillText(date.toUpperCase(), canvas.width - margin, margin - 8)

    const availableWidth = canvas.width - margin * 2 - spacing * (cols - 1)
    const availableHeight = canvas.height - margin * 2 - spacing * (rows - 1)
    const cellWidth = availableWidth / cols
    const cellHeight = availableHeight / rows

    const textSpace = showFilenames || showExif ? fontSize * 3 : 0
    const imageHeight = cellHeight - textSpace
    const imageWidth = cellWidth

    const imagePromises = photos.slice(0, cols * rows).map((photo, index) => {
      return new Promise<void>(resolve => {
        const col = index % cols
        const row = Math.floor(index / cols)

        const cellX = margin + col * (cellWidth + spacing)
        const cellY = margin + row * (cellHeight + spacing)

        const img = new Image()
        img.onload = () => {
          const imgAspect = img.width / img.height
          const cellAspect = imageWidth / imageHeight

          let drawWidth: number
          let drawHeight: number
          let drawX: number
          let drawY: number

          if (imgAspect > cellAspect) {
            drawWidth = imageWidth
            drawHeight = imageWidth / imgAspect
            drawX = cellX
            drawY = cellY + (imageHeight - drawHeight) / 2
          } else {
            drawHeight = imageHeight
            drawWidth = imageHeight * imgAspect
            drawX = cellX + (imageWidth - drawWidth) / 2
            drawY = cellY
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

          ctx.strokeStyle = palette.rule
          ctx.lineWidth = 0.5
          ctx.strokeRect(drawX, drawY, drawWidth, drawHeight)

          if (showFilenames || showExif) {
            ctx.textAlign = 'left'
            let textY = cellY + imageHeight + fontSize + 2
            let textX = cellX

            if (showRank) {
              const rank = String(rankOffset + index + 1).padStart(3, '0')
              ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`
              ctx.fillStyle = palette.accent
              ctx.fillText(rank, textX, textY)
              textX += ctx.measureText(`${rank} `).width
            }

            if (showFilenames) {
              ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`
              ctx.fillStyle = palette.label
              const filename =
                photo.name.length > 20 ? photo.name.substring(0, 17) + '...' : photo.name
              ctx.fillText(filename, textX, textY)
              textY += fontSize + 1
            }

            if (showExif && photo.exif) {
              const settings = formatExif(photo.exif)
              if (settings) {
                ctx.font = `${fontSize - 2}px Helvetica, Arial, sans-serif`
                ctx.fillStyle = palette.muted
                ctx.fillText(settings, cellX, textY)
              }
            }
          }
          resolve()
        }
        img.onerror = () => resolve()
        img.src = photo.imageUrl
      })
    })

    await Promise.all(imagePromises)
  }

  /**
   * Render every photo across as many sheets as it takes, calling back with each
   * finished sheet. Rank numbering stays continuous across pages.
   */
  const generateContactSheets = async (
    canvas: HTMLCanvasElement,
    photos: Photo[],
    options: Partial<ContactSheetOptions> = DEFAULTS,
    onSheet?: (dataUrl: string, page: number, total: number) => void | Promise<void>
  ): Promise<string[]> => {
    const pages = paginate(photos)
    const out: string[] = []
    for (let i = 0; i < pages.length; i++) {
      await generateContactSheet(canvas, pages[i], {
        ...options,
        rankOffset: i * pages[0].length,
        title:
          options.title ??
          `CONTACT SHEET — ${photos.length} IMAGES — SHEET ${i + 1} / ${pages.length}`
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.93)
      out.push(dataUrl)
      if (onSheet) await onSheet(dataUrl, i + 1, pages.length)
    }
    return out
  }

  return {
    calculateGrid,
    generateContactSheet,
    generateContactSheets,
    paginate,
    sheetCapacity,
    formatExif
  }
}
