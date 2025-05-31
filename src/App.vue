<template>
  <div class="min-h-screen bg-white text-black">
    <!-- Header -->
    <div class="border-b p-4">
      <h1 class="text-sm">EXIF Photo Printer</h1>
    </div>

    <div class="flex">
      <!-- Sidebar -->
      <div class="w-64 border-r min-h-screen">
        <!-- Drop Zone -->
        <div class="p-4 border-b">
          <div 
            @drop="handleDrop" 
            @dragover.prevent 
            @dragenter.prevent
            @dragleave="dragLeave"
            :class="[
              'border-2 border-dashed p-6 text-center text-xs',
              isDragOver ? 'border-blue-500' : 'border'
            ]"
          >
            Drop photos
          </div>
          
          <button 
            @click="importFiles" 
            class="w-full mt-2 p-2 border text-xs"
          >
            Import Files
          </button>
          
          <button 
            @click="importFolder" 
            class="w-full mt-1 p-2 border text-xs"
          >
            Import Folder
          </button>
        </div>

        <!-- Settings -->
        <div v-if="photos.length > 0" class="p-4 space-y-3">
          <div>
            <label class="block text-xs mb-1">Size</label>
            <select 
              v-model="globalSettings.printSize" 
              @change="applyGlobalSettings"
              class="w-full p-1 border bg-white text-xs"
            >
              <option value="4x6">4x6"</option>
              <option value="5x7">5x7"</option>
              <option value="8x10">8x10"</option>
              <option value="8x12">8x12"</option>
              <option value="11x14">11x14"</option>
              <option value="square">5x5"</option>
            </select>
          </div>

          <div>
            <label class="block text-xs mb-1">Fit</label>
            <div class="flex">
              <button 
                @click="globalSettings.fitMode = 'fit'; applyGlobalSettings()" 
                :class="[
                  'flex-1 p-1 text-xs border',
                  globalSettings.fitMode === 'fit' ? 'bg-black text-white' : 'bg-white'
                ]"
              >
                Preserve
              </button>
              <button 
                @click="globalSettings.fitMode = 'fill'; applyGlobalSettings()" 
                :class="[
                  'flex-1 p-1 text-xs border-l-0 border',
                  globalSettings.fitMode === 'fill' ? 'bg-black text-white' : 'bg-white'
                ]"
              >
                Fill
              </button>
            </div>
          </div>

          <label class="flex text-xs">
            <input 
              type="checkbox" 
              v-model="globalSettings.blackBorder" 
              @change="applyGlobalSettings"
              class="mr-2"
            >
            Black border
          </label>

          <button 
            @click="downloadAll" 
            :disabled="downloadStatus.isDownloading || photos.length === 0"
            class="w-full p-2 bg-black text-white text-xs disabled:opacity-50"
            style="cursor: pointer;"
          >
            <span v-if="downloadStatus.isDownloading">Saving...</span>
            <span v-else>Download All ({{ photos.length }})</span>
          </button>
          
          
          <!-- Success message and Open in Finder -->
          <div v-if="downloadStatus.lastDownloadPath && !downloadStatus.isDownloading" 
               class="mt-2 p-2 bg-green-50 border border-green-200 text-xs">
            <div class="text-green-700 mb-1">
              ✓ {{ downloadStatus.downloadCount }} files saved
            </div>
            <button 
              @click="openInFinder"
              class="w-full p-1 bg-green-600 text-white text-xs hover:bg-green-700"
            >
              Open in Finder
            </button>
          </div>
        </div>
      </div>

      <!-- Main Area -->
      <div class="flex-1 p-4">
        <div v-if="photos.length === 0" class="text-center text-gray-500 mt-20">
          <div class="text-xs">Drop photos to start</div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            v-for="(photo, index) in photos" 
            :key="photo.id" 
            class="border"
          >
            <div class="p-3 border-b">
              <div class="text-xs truncate">{{ photo.name }}</div>
              <div class="text-xs text-gray-500 mt-1">
                {{ photo.exif.Make }} {{ photo.exif.Model }}
              </div>
            </div>

            <div class="p-3">
              <canvas 
                :ref="el => canvasRefs[index] = el"
                :width="getSizeConfig(globalSettings.printSize).width" 
                :height="getSizeConfig(globalSettings.printSize).height"
                class="w-full border"
              ></canvas>
              
              <div class="flex mt-2 text-xs">
                <button 
                  @click="generatePrint(index)" 
                  class="flex-1 p-1 border"
                >
                  Regen
                </button>
                <button 
                  @click="downloadPrint(index)" 
                  class="flex-1 p-1 border-l-0 border bg-black text-white"
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { usePhotoProcessing } from './composables/usePhotoProcessing'
import { usePrintSizes } from './composables/usePrintSizes'

export default {
  name: 'App',
  data() {
    return {
      photos: [],
      isDragOver: false,
      canvasRefs: [],
      globalSettings: {
        printSize: '4x6',
        fitMode: 'fit',
        blackBorder: false
      },
      downloadStatus: {
        isDownloading: false,
        lastDownloadPath: null,
        downloadCount: 0
      },
      tauriUnlisteners: [] // Store cleanup functions
    }
  },
  
  watch: {
    photos: {
      handler() {
        this.$nextTick(() => {
          this.photos.forEach((photo, index) => {
            this.generatePrint(index)
          })
        })
      },
      deep: true
    }
  },

  mounted() {
    if (window.__TAURI__) {
      this.setupTauriDropEvents()
    }
  },

  beforeUnmount() {
    // Clean up all Tauri event listeners
    this.tauriUnlisteners.forEach(unlisten => {
      if (typeof unlisten === 'function') {
        unlisten()
      }
    })
    this.tauriUnlisteners = []
  },

  setup() {
    const { createPhotoFromExif, processPhoto, processPhotoFromPath, isImageFile } = usePhotoProcessing()
    const { getSizeConfig } = usePrintSizes()
    
    return {
      createPhotoFromExif,
      processPhoto,
      processPhotoFromPath,
      isImageFile,
      getSizeConfig
    }
  },

  methods: {
    async setupTauriDropEvents() {
      try {
        const { listen } = window.__TAURI__.event
        
        // Listen for file drop events
        const dropUnlisten = await listen('tauri://drag-drop', async (event) => {
          try {
            const files = event.payload.paths || []
            for (const filePath of files) {
              if (this.isImageFile(filePath)) {
                const photo = await this.processPhotoFromPath(filePath)
                if (photo) this.photos.push(photo)
              }
            }
            this.isDragOver = false
          } catch (error) {
            console.error('Error processing dropped files:', error)
            this.isDragOver = false
          }
        })
        
        // Listen for drag over events to update UI
        const dragOverUnlisten = await listen('tauri://drag-over', (event) => {
          this.isDragOver = true
        })
        
        // Store cleanup functions
        this.tauriUnlisteners.push(dropUnlisten, dragOverUnlisten)
      } catch (error) {
        console.error('Error setting up Tauri drop events:', error)
      }
    },

    dragLeave() {
      this.isDragOver = false
    },

    async handleDrop(event) {
      event.preventDefault()
      this.isDragOver = false

      if (window.__TAURI__) {
        // File drops are handled by Tauri events in setupTauriDropEvents()
        return
      }

      // Fallback for web browsers
      const files = Array.from(event.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      )

      for (const file of files) {
        const photo = await this.processPhoto(file)
        this.photos.push(photo)
      }
    },

    async generatePrint(index) {
      const photo = this.photos[index]
      const canvas = this.canvasRefs[index]
      
      if (!canvas || !photo) return

      const ctx = canvas.getContext('2d')
      const img = new Image()
      const sizeConfig = this.getSizeConfig(this.globalSettings.printSize)
      
      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, sizeConfig.width, sizeConfig.height)
        
        const isPortrait = img.height > img.width
        let imgWidth = img.width
        let imgHeight = img.height
        
        if (isPortrait) {
          imgWidth = img.height
          imgHeight = img.width
        }
        
        const borderSize = 90
        const imageArea = {
          x: borderSize,
          y: borderSize,
          width: sizeConfig.width - (borderSize * 2),
          height: sizeConfig.height - (borderSize * 2)
        }
        
        const imgAspect = imgWidth / imgHeight
        const areaAspect = imageArea.width / imageArea.height
        
        let drawWidth, drawHeight
        
        if (this.globalSettings.fitMode === 'fit') {
          if (imgAspect > areaAspect) {
            drawWidth = imageArea.width
            drawHeight = imageArea.width / imgAspect
          } else {
            drawHeight = imageArea.height
            drawWidth = imageArea.height * imgAspect
          }
        } else {
          if (imgAspect > areaAspect) {
            drawHeight = imageArea.height
            drawWidth = imageArea.height * imgAspect
          } else {
            drawWidth = imageArea.width
            drawHeight = imageArea.width / imgAspect
          }
        }
        
        const drawX = imageArea.x + (imageArea.width - drawWidth) / 2
        const drawY = imageArea.y + (imageArea.height - drawHeight) / 2
        
        ctx.save()
        
        if (isPortrait) {
          ctx.translate(drawX + drawWidth/2, drawY + drawHeight/2)
          ctx.rotate(Math.PI/2)
          ctx.drawImage(img, -drawHeight/2, -drawWidth/2, drawHeight, drawWidth)
        } else {
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
        }
        
        ctx.restore()
        
        if (this.globalSettings.blackBorder) {
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 8
          ctx.strokeRect(drawX - 4, drawY - 4, drawWidth + 8, drawHeight + 8)
        }
        
        // EXIF text
        const fontSize = Math.floor(sizeConfig.width / 120)
        ctx.fillStyle = '#222'
        ctx.font = `${fontSize}px monospace`
        
        const pad = borderSize * 0.2
        
        // Camera
        ctx.textAlign = 'left'
        const camera = [photo.exif.Make, photo.exif.Model].filter(Boolean).join(' ')
        if (camera && camera !== 'Unknown Camera') {
          ctx.fillText(camera.toUpperCase(), pad, pad + fontSize)
        }
        
        // Lens
        ctx.textAlign = 'right'
        if (photo.exif.LensModel) {
          ctx.fillText(photo.exif.LensModel.toUpperCase(), sizeConfig.width - pad, pad + fontSize)
        }
        
        // Settings
        ctx.textAlign = 'left'
        const settings = []
        if (photo.exif.FocalLength !== '50') settings.push(`${photo.exif.FocalLength}MM`)
        if (photo.exif.FNumber !== '5.6') settings.push(`F${photo.exif.FNumber}`)
        if (photo.exif.ExposureTime !== '1/60') {
          const speed = parseFloat(photo.exif.ExposureTime)
          const formatted = speed >= 1 ? `${Math.round(speed)}S` : `1/${Math.round(1/speed)}S`
          settings.push(formatted)
        }
        if (photo.exif.ISO !== '400') settings.push(`ISO${photo.exif.ISO}`)
        
        if (settings.length > 0) {
          ctx.fillText(settings.join(' · '), pad, sizeConfig.height - pad)
        }
        
        // Filename
        ctx.textAlign = 'right'
        const name = photo.name.length > 50 ? photo.name.substring(0, 47) + '…' : photo.name
        ctx.fillText(name.toUpperCase(), sizeConfig.width - pad, sizeConfig.height - pad)
        
        // Date
        if (photo.exif.DateTimeOriginal) {
          ctx.save()
          ctx.textAlign = 'center'
          ctx.translate(sizeConfig.width - pad, sizeConfig.height / 2)
          ctx.rotate(-Math.PI / 2)
          
          const date = new Date(photo.exif.DateTimeOriginal)
          const formatted = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          
          ctx.fillText(formatted, 0, 0)
          ctx.restore()
        }
      }
      
      img.src = photo.imageUrl
    },

    downloadPrint(index) {
      const canvas = this.canvasRefs[index]
      const photo = this.photos[index]
      
      if (!canvas) return
      
      const link = document.createElement('a')
      link.download = `${photo.name.split('.')[0]}_print.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    },

    async downloadAll() {
      if (window.__TAURI__) {
        this.downloadStatus.isDownloading = true
        
        try {
          // Select directory with proper error handling
          const { invoke } = window.__TAURI__.tauri
          const selectedDir = await invoke('select_directory')
          if (!selectedDir) {
            this.downloadStatus.isDownloading = false
            return // User cancelled
          }
          
          // Prepare all files for batch download
          const files = []
          for (let index = 0; index < this.photos.length; index++) {
            const photo = this.photos[index]
            const canvas = this.canvasRefs[index]
            if (canvas) {
              const dataURL = canvas.toDataURL('image/png')
              const filename = `${photo.name.split('.')[0]}_print.png`
              files.push({ filename, dataURL })
            }
          }
          
          // Download all files in one batch - no dialogs!
          const result = await invoke('download_files', { files, directory: selectedDir })
          this.downloadStatus.isDownloading = false
          
          if (result.success) {
            this.downloadStatus.lastDownloadPath = result.directory
            this.downloadStatus.downloadCount = result.count
            // Success animation/feedback handled by UI
          } else {
            alert(`Error saving files: ${result.error}`)
          }
        } catch (error) {
          this.downloadStatus.isDownloading = false
          alert(`Error during download: ${error.message}`)
        }
      } else {
        // Fallback for web browsers - download to default download folder
        this.photos.forEach((photo, index) => {
          setTimeout(() => {
            this.downloadPrint(index)
          }, index * 100)
        })
      }
    },

    async openInFinder() {
      if (window.__TAURI__ && this.downloadStatus.lastDownloadPath) {
        const { invoke } = window.__TAURI__.tauri
        await invoke('open_in_finder', { folderPath: this.downloadStatus.lastDownloadPath })
      }
    },

    applyGlobalSettings() {
      this.$nextTick(() => {
        this.photos.forEach((photo, index) => {
          this.generatePrint(index)
        })
      })
    },

    async importFiles() {
      if (window.__TAURI__) {
        try {
          const { invoke } = window.__TAURI__.tauri
          const filePaths = await invoke('import_files')
          
          for (const filePath of filePaths) {
            const photo = await this.processPhotoFromPath(filePath)
            if (photo) this.photos.push(photo)
          }
        } catch (error) {
          console.error('Error importing files:', error)
          alert(`Error importing files: ${error}`)
        }
      } else {
        // Fallback for web browsers
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.accept = 'image/*'
        
        input.onchange = async (event) => {
          const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('image/')
          )
          
          for (const file of files) {
            const photo = await this.processPhoto(file)
            this.photos.push(photo)
          }
        }
        
        input.click()
      }
    },

    async importFolder() {
      if (window.__TAURI__) {
        try {
          const { invoke } = window.__TAURI__.tauri
          const filePaths = await invoke('import_folder')
          
          for (const filePath of filePaths) {
            const photo = await this.processPhotoFromPath(filePath)
            if (photo) this.photos.push(photo)
          }
        } catch (error) {
          console.error('Error importing folder:', error)
          alert(`Error importing folder: ${error}`)
        }
      } else {
        // Fallback for web browsers
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.multiple = true
        input.accept = 'image/*'
        
        input.onchange = async (event) => {
          const files = Array.from(event.target.files).filter(file => 
            file.type.startsWith('image/')
          )
          
          for (const file of files) {
            const photo = await this.processPhoto(file)
            this.photos.push(photo)
          }
        }
        
        input.click()
      }
    }
  }
}
</script>