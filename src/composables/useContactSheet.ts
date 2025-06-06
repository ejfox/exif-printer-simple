interface Photo {
  id: string
  name: string
  imageUrl: string
  exif: any
}

export function useContactSheet() {
  const calculateGrid = (totalPhotos: number) => {
    // Optimal grid layouts for different photo counts
    if (totalPhotos <= 6) return { cols: 3, rows: 2 }
    if (totalPhotos <= 12) return { cols: 4, rows: 3 }
    if (totalPhotos <= 20) return { cols: 5, rows: 4 }
    if (totalPhotos <= 30) return { cols: 6, rows: 5 }
    if (totalPhotos <= 42) return { cols: 7, rows: 6 }
    return { cols: 8, rows: 7 } // Max 56 photos
  }

  const generateContactSheet = async (
    canvas: HTMLCanvasElement,
    photos: Photo[],
    options = {
      showFilenames: true,
      showExif: true,
      margin: 20,
      spacing: 8,
      fontSize: 8
    }
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { cols, rows } = calculateGrid(photos.length)
    const { margin, spacing, fontSize, showFilenames, showExif } = options

    // Clear canvas with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Add title and metadata first
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `${fontSize + 2}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(`CONTACT SHEET — ${photos.length} IMAGES`, margin, margin - 8)

    // Add date
    ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillStyle = '#6b7280'
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
    ctx.fillText(date.toUpperCase(), canvas.width - margin, margin - 8)

    // Calculate cell dimensions
    const availableWidth = canvas.width - (margin * 2) - (spacing * (cols - 1))
    const availableHeight = canvas.height - (margin * 2) - (spacing * (rows - 1))
    const cellWidth = availableWidth / cols
    const cellHeight = availableHeight / rows

    // Calculate image area within each cell (leave space for text)
    const textSpace = showFilenames || showExif ? fontSize * 3 : 0
    const imageHeight = cellHeight - textSpace
    const imageWidth = cellWidth

    // Load all images and wait for them to complete
    const imagePromises = photos.slice(0, cols * rows).map((photo, index) => {
      return new Promise<void>((resolve) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        
        const cellX = margin + col * (cellWidth + spacing)
        const cellY = margin + row * (cellHeight + spacing)

        const img = new Image()
        img.onload = () => {
          // Calculate image scaling to fit within cell
          const imgAspect = img.width / img.height
          const cellAspect = imageWidth / imageHeight

          let drawWidth, drawHeight, drawX, drawY

          if (imgAspect > cellAspect) {
            // Image is wider, fit to width
            drawWidth = imageWidth
            drawHeight = imageWidth / imgAspect
            drawX = cellX
            drawY = cellY + (imageHeight - drawHeight) / 2
          } else {
            // Image is taller, fit to height
            drawHeight = imageHeight
            drawWidth = imageHeight * imgAspect
            drawX = cellX + (imageWidth - drawWidth) / 2
            drawY = cellY
          }

          // Draw image
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

          // Draw subtle border around image
          ctx.strokeStyle = '#e5e7eb'
          ctx.lineWidth = 0.5
          ctx.strokeRect(drawX, drawY, drawWidth, drawHeight)

          // Add text below image
          if (showFilenames || showExif) {
            ctx.fillStyle = '#374151'
            ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`
            ctx.textAlign = 'left'

            let textY = cellY + imageHeight + fontSize + 2

            if (showFilenames) {
              const filename = photo.name.length > 20 
                ? photo.name.substring(0, 17) + '...' 
                : photo.name
              ctx.fillText(filename, cellX, textY)
              textY += fontSize + 1
            }

            if (showExif && photo.exif) {
              const settings = []
              
              // Ultra-abbreviated format: 35mm f/2.8 1/125 800
              if (photo.exif.FocalLength) {
                settings.push(`${photo.exif.FocalLength}mm`)
              }
              if (photo.exif.FNumber) {
                settings.push(`f/${photo.exif.FNumber}`)
              }
              if (photo.exif.ExposureTime) {
                const speed = parseFloat(photo.exif.ExposureTime)
                const formatted = speed >= 1 ? `${speed}s` : `1/${Math.round(1/speed)}`
                settings.push(formatted)
              }
              if (photo.exif.ISO) {
                settings.push(photo.exif.ISO)
              }

              if (settings.length > 0) {
                ctx.font = `${fontSize - 2}px Helvetica, Arial, sans-serif`
                ctx.fillStyle = '#9ca3af'
                ctx.fillText(settings.join(' '), cellX, textY)
              }
            }
          }
          resolve()
        }
        img.onerror = () => resolve() // Continue even if image fails to load
        img.src = photo.imageUrl
      })
    })

    // Wait for all images to load and be drawn
    await Promise.all(imagePromises)
  }

  return {
    calculateGrid,
    generateContactSheet
  }
}