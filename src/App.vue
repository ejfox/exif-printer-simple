<template>
  <div class="h-screen bg-white text-black flex flex-col">
    <!-- Header -->
    <div class="border-b p-4 flex-shrink-0">
      <h1 class="text-sm text-luxury">EXIF Photo Printer</h1>
      <div class="divider mt-2"></div>
    </div>

    <!-- Top Half: Sidebar + Grid -->
    <div class="flex flex-1 overflow-hidden" :class="{ 'h-1/2': previewPane.isVisible }">
      <!-- Sidebar -->
      <div class="w-64 border-r card-subtle flex-shrink-0 overflow-y-auto">
        <!-- Drop Zone -->
        <div class="p-4 border-b">
          <div 
            :class="[
              'border-2 border-dashed p-6 text-center text-xs transition-all duration-300 ease-in-out',
              isDragOver ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg' : 'border-gray-300 hover:border-gray-400',
              isProcessingFiles ? 'processing-indicator' : ''
            ]"
          >
            <div :class="['transition-all duration-300', isDragOver ? 'text-blue-600 font-medium' : 'text-gray-600']">
              <span v-if="isProcessingFiles" class="inline-block animate-spin">⚙️</span>
              {{ getDropZoneText() }}
            </div>
            <div v-if="processingCount > 0" class="mt-2 text-micro text-gray-500">
              Processing {{ processingCount }} photos...
            </div>
          </div>
          
          <button 
            @click="importFiles" 
            class="w-full mt-2 p-2 border text-xs bg-white text-black"
          >
            Import Files
          </button>
          
          <button 
            @click="importFolder" 
            class="w-full mt-1 p-2 border text-xs bg-white text-black"
          >
            Import Folder
          </button>
        </div>

        <!-- Settings -->
        <div v-if="photos.length > 0" class="p-4 space-y-3">
          <div>
            <label class="block text-xs mb-1">Format</label>
            <div class="grid grid-cols-2 gap-1 mb-2">
              <button 
                @click="globalSettings.printSize = 'contact'; applyGlobalSettings()" 
                :class="[
                  'p-2 text-xs border',
                  globalSettings.printSize === 'contact' ? 'bg-black text-white' : 'bg-white text-black'
                ]"
              >
                📄 Contact Sheet
              </button>
              <button 
                @click="globalSettings.printSize = '4x6'; applyGlobalSettings()" 
                :class="[
                  'p-2 text-xs border',
                  globalSettings.printSize !== 'contact' ? 'bg-black text-white' : 'bg-white text-black'
                ]"
              >
                🖼️ Individual Prints
              </button>
            </div>
            
            <select 
              v-if="globalSettings.printSize !== 'contact'"
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
              <option value="video-4k">📹 4K Video (3840x2160)</option>
              <option value="video-1080p">📹 1080p Video (1920x1080)</option>
            </select>
          </div>

          <div v-if="globalSettings.printSize !== 'contact'">
            <label class="block text-xs mb-1">Fit</label>
            <div class="flex">
              <button 
                @click="globalSettings.fitMode = 'fit'; applyGlobalSettings()" 
                :class="[
                  'flex-1 p-1 text-xs border',
                  globalSettings.fitMode === 'fit' ? 'bg-black text-white' : 'bg-white text-black'
                ]"
              >
                Preserve
              </button>
              <button 
                @click="globalSettings.fitMode = 'fill'; applyGlobalSettings()" 
                :class="[
                  'flex-1 p-1 text-xs border-l-0 border',
                  globalSettings.fitMode === 'fill' ? 'bg-black text-white' : 'bg-white text-black'
                ]"
              >
                Fill
              </button>
            </div>
          </div>

          <label v-if="globalSettings.printSize !== 'contact'" class="flex text-xs">
            <input 
              type="checkbox" 
              v-model="globalSettings.blackBorder" 
              @change="applyGlobalSettings"
              class="mr-2"
            >
            Black border
          </label>

          <div>
            <label class="flex text-xs">
              <input 
                type="checkbox" 
                v-model="globalSettings.commercialPrintSafe" 
                @change="applyGlobalSettings"
                class="mr-2"
              >
              Commercial print safe
            </label>
            <div v-if="globalSettings.commercialPrintSafe" class="text-micro text-gray-500 ml-5 mt-1">
              Adds wider margins for Walgreens, CVS, Walmart
            </div>
          </div>

          <div>
            <label class="block text-xs mb-1">EXIF Margin (px)</label>
            <input
              type="range"
              v-model.number="globalSettings.marginSize"
              @input="applyGlobalSettings"
              min="30"
              max="300"
              step="10"
              class="w-full"
            >
            <div class="flex justify-between text-micro text-gray-500 mt-1">
              <span>30px (Tight)</span>
              <span>{{ globalSettings.marginSize }}px</span>
              <span>300px (Wide)</span>
            </div>
            <div class="text-micro text-gray-400 mt-1">
              Distance from edge to EXIF text ({{ Math.round(globalSettings.marginSize / 300 * 100) / 100 }}" at 300 DPI)
            </div>
          </div>

          <div>
            <label class="block text-xs mb-1">Text Size</label>
            <input
              type="range"
              v-model.number="globalSettings.textSize"
              @input="applyGlobalSettings"
              min="0.7"
              max="2.0"
              step="0.1"
              class="w-full"
            >
            <div class="flex justify-between text-micro text-gray-500 mt-1">
              <span>Small</span>
              <span>{{ globalSettings.textSize }}x</span>
              <span>Large</span>
            </div>
          </div>

          <!-- Preview pane option disabled for now -->

          <div v-if="globalSettings.printSize === 'contact'" class="space-y-2">
            <label class="flex text-xs">
              <input 
                type="checkbox" 
                v-model="globalSettings.showFilenames" 
                @change="applyGlobalSettings"
                class="mr-2"
              >
              Show filenames
            </label>
            <label class="flex text-xs">
              <input 
                type="checkbox" 
                v-model="globalSettings.showExif" 
                @change="applyGlobalSettings"
                class="mr-2"
              >
              Show EXIF data
            </label>
          </div>

          <button 
            @click="exportAll" 
            :disabled="downloadStatus.isDownloading || photos.length === 0"
            class="w-full p-2 btn-primary text-xs disabled:opacity-50"
            style="cursor: pointer;"
          >
            <span v-if="downloadStatus.isDownloading">💾 Exporting...</span>
            <span v-else>📤 Export All ({{ photos.length }})</span>
          </button>
          
          <button 
            @click="clearAllPhotos" 
            :disabled="photos.length === 0"
            class="w-full p-2 border bg-white text-black text-xs disabled:opacity-50 hover:bg-red-50"
          >
            🗑️ Clear All
          </button>
          
          
          <!-- Success message and Open in Finder -->
          <div v-if="downloadStatus.lastDownloadPath && !downloadStatus.isDownloading" 
               class="mt-2 p-2 card-subtle border text-xs">
            <div class="text-micro mb-1">
              ✅ {{ downloadStatus.downloadCount }} prints exported
            </div>
            <button 
              @click="openInFinder"
              class="w-full p-1 btn-primary text-xs"
            >
              📂 Show in Finder
            </button>
          </div>
        </div>
      </div>

      <!-- Main Area -->
      <div class="flex-1 overflow-auto">
        <!-- Photo Gallery -->
        <div class="p-4">
          <div v-if="photos.length === 0" class="text-center text-gray-500 mt-20">
            <div class="text-xs">Drop photos to start</div>
          </div>

          <div v-else-if="globalSettings.printSize === 'contact'" class="flex justify-center">
          <div class="card-subtle max-w-4xl">
            <div class="p-3 border-b flex justify-between items-start">
              <div>
                <div class="text-xs text-luxury">Contact Sheet</div>
                <div class="text-micro text-gray-500 mt-1">
                  {{ photos.length }} images • {{ calculateGrid(photos.length).cols }}×{{ calculateGrid(photos.length).rows }} grid
                </div>
              </div>
              <button 
                @click="clearAllPhotos"
                class="p-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Clear all photos"
              >
                🗑️
              </button>
            </div>
            <div class="p-3">
              <canvas 
                :ref="el => { if (el) canvasRefs[0] = el }"
                :width="getSizeConfig('contact').width" 
                :height="getSizeConfig('contact').height"
                class="w-full border"
              ></canvas>
              
              <div class="mt-2">
                <button 
                  @click="saveContactSheet" 
                  class="w-full p-1 border bg-black text-white text-xs"
                >
                  💾 Save
                </button>
              </div>
            </div>
          </div>
        </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <!-- Skeleton placeholders for processing photos -->
          <div 
            v-for="(skeleton, index) in skeletonPhotos" 
            :key="`skeleton-${skeleton.id}`"
            :class="[
              'card-subtle fade-in',
              `stagger-${(index % 6) + 1}`
            ]"
          >
            <div class="p-3 border-b">
              <div class="skeleton h-4 w-3/4 mb-2 rounded"></div>
              <div class="skeleton h-3 w-1/2 rounded"></div>
            </div>
            <div class="p-3">
              <div class="skeleton w-full aspect-[4/3] rounded mb-2"></div>
              <div class="flex gap-1">
                <div class="skeleton flex-1 h-8 rounded"></div>
                <div class="skeleton flex-1 h-8 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Actual loaded photos -->
          <div 
            v-for="(photo, index) in photos" 
            :key="photo.id" 
            :class="[
              'card-subtle bounce-in cursor-pointer transition-all',
              `stagger-${(index % 6) + 1}`,
              previewPane.selectedPhotoIndex === index ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
            ]"
            @click="selectPhotoForPreview(index)"
          >
            <div class="p-3 border-b flex justify-between items-start">
              <div class="flex-1 min-w-0">
                <div class="text-xs truncate text-luxury">{{ photo.name }}</div>
                <div class="text-micro text-gray-500 mt-1">
                  {{ photo.exif.Make }} {{ photo.exif.Model }}
                </div>
              </div>
              <button 
                @click="removePhoto(index)"
                class="ml-2 p-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Remove photo"
              >
                ✕
              </button>
            </div>

            <!-- Caption editing for video formats -->
            <div v-if="isVideoFormat(globalSettings.printSize)" class="p-3 border-b">
              <label class="block text-xs mb-1 text-luxury">Caption</label>
              <input 
                v-model="photo.customCaption"
                @input="generatePrint(index)"
                placeholder="Custom caption (leave empty for auto-generated)"
                class="w-full p-2 text-xs border bg-white"
              />
              <div class="text-micro text-gray-400 mt-1">
                Auto: {{ getImageCaption(photo) }}
              </div>
            </div>

            <div class="p-2">
              <div class="flex justify-center">
                <canvas
                  :ref="el => {
                    if (el) {
                      canvasRefs[index] = el
                      $nextTick(() => generatePrint(index))
                    }
                  }"
                  :width="getSizeConfig(globalSettings.printSize).width"
                  :height="getSizeConfig(globalSettings.printSize).height"
                  class="border"
                  style="background: white; max-width: 100%; height: auto;"
                ></canvas>
              </div>
              <div class="mt-2">
                <button
                  @click.stop="savePrint(index)"
                  class="w-full p-1 border bg-black text-white text-xs"
                >
                  💾 Save
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Pane - DISABLED for now -->
    <!-- TODO: Fix preview pane properly later -->
  </div>
</template>

<script>
import { usePhotoProcessing } from './composables/usePhotoProcessing'
import { usePrintSizes } from './composables/usePrintSizes'
import { useContactSheet } from './composables/useContactSheet'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export default {
  name: 'App',
  data() {
    return {
      photos: [],
      skeletonPhotos: [], // Placeholder photos while processing
      isDragOver: false,
      canvasRefs: [],
      globalSettings: {
        printSize: '4x6',
        fitMode: 'fit',
        blackBorder: false,
        showFilenames: true,
        showExif: true,
        commercialPrintSafe: true,  // Default to safe mode for commercial printing
        marginSize: 180,  // Custom margin size in pixels (default to commercial safe)
        textSize: 1.0  // Text size multiplier (0.5 to 2.0)
      },
      previewPane: {
        isVisible: false,
        selectedPhotoIndex: null
      },
      downloadStatus: {
        isDownloading: false,
        lastDownloadPath: null,
        downloadCount: 0
      },
      isProcessingFiles: false,
      processingCount: 0,
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

  async mounted() {
    this.setupTauriDropEvents()
    await this.loadFromLocalStorage()
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
    const { getSizeConfig, isVideoFormat } = usePrintSizes()
    const { generateContactSheet, calculateGrid } = useContactSheet()
    
    return {
      createPhotoFromExif,
      processPhoto,
      processPhotoFromPath,
      isImageFile,
      getSizeConfig,
      isVideoFormat,
      generateContactSheet,
      calculateGrid
    }
  },

  watch: {
    'globalSettings.marginSize'() {
      this.applyGlobalSettings()
      if (this.previewPane.selectedPhotoIndex !== null) {
        this.$nextTick(() => this.updatePreview())
      }
    },
    'globalSettings.textSize'() {
      this.applyGlobalSettings()
      if (this.previewPane.selectedPhotoIndex !== null) {
        this.$nextTick(() => this.updatePreview())
      }
    },
    'globalSettings.printSize'() {
      if (this.previewPane.selectedPhotoIndex !== null) {
        this.$nextTick(() => this.updatePreview())
      }
    },
    globalSettings: {
      handler() {
        this.saveToLocalStorage()
      },
      deep: true
    }
  },

  methods: {
    async setupTauriDropEvents() {
      try {
        
        // Listen for file drop events
        const dropUnlisten = await listen('tauri://drag-drop', async (event) => {
          try {
            this.isDragOver = false
            const files = event.payload.paths || []
            
            if (files.length > 0) {
              this.isProcessingFiles = true
              this.processingCount = files.filter(this.isImageFile).length
              
              // Add skeleton placeholders for all images
              const imageFiles = files.filter(this.isImageFile)
              this.skeletonPhotos = imageFiles.map((filePath, index) => ({
                id: `skeleton-${Date.now()}-${index}`,
                name: filePath.split('/').pop() || 'Unknown',
                processing: true
              }))
              
              // Process photos one by one with staggered timing, starting from the first
              for (let i = 0; i < imageFiles.length; i++) {
                const filePath = imageFiles[i]
                try {
                  const photo = await this.processPhotoFromPath(filePath)
                  if (photo) {
                    // Remove the first remaining skeleton and add photo to end
                    this.skeletonPhotos.shift()
                    this.photos.push(photo)
                    
                    // Small delay for staggered effect
                    if (i < imageFiles.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 150))
                    }
                  }
                } catch (error) {
                  console.error(`Error processing ${filePath}:`, error)
                  this.skeletonPhotos.shift() // Remove first skeleton on error
                }
                this.processingCount--
              }
              
              this.isProcessingFiles = false
              this.skeletonPhotos = []
            }
          } catch (error) {
            console.error('Error processing dropped files:', error)
            this.isDragOver = false
            this.isProcessingFiles = false
            this.skeletonPhotos = []
            this.processingCount = 0
          }
        })
        
        // Listen for drag over events to update UI  
        const dragOverUnlisten = await listen('tauri://drag-over', (event) => {
          this.isDragOver = true
        })
        
        // Listen for drag leave events
        const dragLeaveUnlisten = await listen('tauri://drag-leave', (event) => {
          this.isDragOver = false
        })
        
        // Store cleanup functions
        this.tauriUnlisteners.push(dropUnlisten, dragOverUnlisten, dragLeaveUnlisten)
      } catch (error) {
        console.error('Error setting up Tauri drop events:', error)
      }
    },

    async generateVideoFormat(index, targetCanvas = null) {
      const canvas = targetCanvas || this.canvasRefs[index]
      const photo = this.photos[index]
      
      if (!canvas || !photo) return

      const ctx = canvas.getContext('2d')
      const img = new Image()
      const sizeConfig = this.getSizeConfig(this.globalSettings.printSize)
      
      img.onerror = (error) => {
        console.warn('Image load error for photo:', photo.name, error)
        // Fill with a placeholder color if image fails to load
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(0, 0, sizeConfig.width, sizeConfig.height)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '16px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Image Load Error', sizeConfig.width / 2, sizeConfig.height / 2)
      }
      
      img.onload = () => {
        // Black background for video format
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, sizeConfig.width, sizeConfig.height)
        
        // Calculate video area (16:9 aspect ratio)
        const videoWidth = sizeConfig.width
        const videoHeight = this.globalSettings.printSize === 'video-4k' ? 2160 : 1080
        const captionHeight = sizeConfig.height - videoHeight
        
        // Image area within video dimensions
        const imgAspect = img.width / img.height
        const videoAspect = videoWidth / videoHeight
        
        let drawWidth, drawHeight, drawX, drawY
        
        // Fit image within video area
        if (imgAspect > videoAspect) {
          drawWidth = videoWidth
          drawHeight = videoWidth / imgAspect
        } else {
          drawHeight = videoHeight
          drawWidth = videoHeight * imgAspect
        }
        
        drawX = (videoWidth - drawWidth) / 2
        drawY = (videoHeight - drawHeight) / 2
        
        // Draw the image
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
        
        // Caption area
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, videoHeight, sizeConfig.width, captionHeight)
        
        // Caption text
        const caption = this.getImageCaption(photo)
        if (caption) {
          // Dynamic font sizing based on caption length
          let fontSize = Math.max(24, Math.min(36, Math.floor(sizeConfig.width / (caption.length * 0.6))))
          
          ctx.fillStyle = '#ffffff'
          ctx.font = `${fontSize}px 'Monaco', 'Menlo', 'Ubuntu Mono', monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          
          const captionY = videoHeight + (captionHeight / 2)
          ctx.fillText(caption, sizeConfig.width / 2, captionY)
        }
      }
      
      img.src = photo.imageUrl
    },

    getImageCaption(photo) {
      // Create caption from EXIF data or use custom caption if available
      if (photo.customCaption) {
        return photo.customCaption
      }
      
      // Generate caption from EXIF data
      const parts = []
      
      // Camera info
      const camera = [photo.exif.Make, photo.exif.Model].filter(Boolean).join(' ')
      if (camera && camera !== 'Unknown Camera') {
        parts.push(camera)
      }
      
      // Lens info
      if (photo.exif.LensModel) {
        parts.push(photo.exif.LensModel)
      }
      
      // Settings
      const settings = []
      if (photo.exif.FocalLength && photo.exif.FocalLength !== '50') settings.push(`${photo.exif.FocalLength}mm`)
      if (photo.exif.FNumber && photo.exif.FNumber !== '5.6') settings.push(`f/${photo.exif.FNumber}`)
      if (photo.exif.ExposureTime && photo.exif.ExposureTime !== '1/60') {
        const speed = parseFloat(photo.exif.ExposureTime)
        const formatted = speed >= 1 ? `${Math.round(speed)}s` : `1/${Math.round(1/speed)}s`
        settings.push(formatted)
      }
      if (photo.exif.ISO && photo.exif.ISO !== '400') settings.push(`ISO ${photo.exif.ISO}`)
      
      if (settings.length > 0) {
        parts.push(settings.join(' • '))
      }
      
      return parts.join(' | ')
    },

    async generatePrint(index) {
      const canvas = this.canvasRefs[index]
      
      if (!canvas) {
        console.warn('No canvas found for index:', index)
        return
      }
      
      // Handle contact sheet differently
      if (this.globalSettings.printSize === 'contact') {
        await this.generateContactSheet(canvas, this.photos, {
          showFilenames: this.globalSettings.showFilenames,
          showExif: this.globalSettings.showExif,
          margin: this.globalSettings.marginSize || (this.globalSettings.commercialPrintSafe ? 180 : 40),
          spacing: 12,
          fontSize: 10
        })
        return
      }

      // Handle video formats differently
      if (this.isVideoFormat(this.globalSettings.printSize)) {
        await this.generateVideoFormat(index)
        return
      }

      const photo = this.photos[index]
      if (!photo) return

      const ctx = canvas.getContext('2d')
      const img = new Image()
      const sizeConfig = this.getSizeConfig(this.globalSettings.printSize)
      
      img.onerror = (error) => {
        console.warn('Image load error for photo:', photo.name, error)
        // Fill with a placeholder color if image fails to load
        ctx.fillStyle = '#f3f4f6'
        ctx.fillRect(0, 0, sizeConfig.width, sizeConfig.height)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '16px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('Image Load Error', sizeConfig.width / 2, sizeConfig.height / 2)
      }
      
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
        
        // Text padding is fixed near edge, image margin is adjustable
        const textPad = 30 // Text always near edge
        const fontSize = Math.floor((sizeConfig.width / 100) * this.globalSettings.textSize)
        const minMargin = textPad + fontSize * 1.5 // Minimum to ensure text is visible
        const requestedMargin = this.globalSettings.marginSize || (this.globalSettings.commercialPrintSafe ? 180 : 90)
        const imageMargin = Math.max(minMargin, requestedMargin)
        const imageArea = {
          x: imageMargin,
          y: imageMargin,
          width: sizeConfig.width - (imageMargin * 2),
          height: sizeConfig.height - (imageMargin * 2)
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
          // Refined border with subtle shadow effect
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 6 // Slightly thinner, more elegant
          ctx.strokeRect(drawX - 3, drawY - 3, drawWidth + 6, drawHeight + 6)
          
          // Reset shadow
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        }
        
        // EXIF text with refined styling
        ctx.fillStyle = '#1a1a1a' // Darker, more readable
        ctx.font = `${fontSize}px 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace`
        ctx.textBaseline = 'alphabetic'

        // Camera info with refined typography
        ctx.textAlign = 'left'
        const camera = [photo.exif.Make, photo.exif.Model].filter(Boolean).join(' ')
        if (camera && camera !== 'Unknown Camera') {
          // Add subtle text shadow for better readability
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(camera.toUpperCase(), textPad, textPad + fontSize * 0.8)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }

        // Lens info
        ctx.textAlign = 'right'
        if (photo.exif.LensModel) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(photo.exif.LensModel.toUpperCase(), sizeConfig.width - textPad, textPad + fontSize * 0.8)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
        
        // Settings with improved formatting
        ctx.textAlign = 'left'
        const settings = []
        if (photo.exif.FocalLength && photo.exif.FocalLength !== '50') settings.push(`${photo.exif.FocalLength}mm`)
        if (photo.exif.FNumber && photo.exif.FNumber !== '5.6') settings.push(`ƒ${photo.exif.FNumber}`)
        if (photo.exif.ExposureTime && photo.exif.ExposureTime !== '1/60') {
          const speed = parseFloat(photo.exif.ExposureTime)
          const formatted = speed >= 1 ? `${Math.round(speed)}s` : `1/${Math.round(1/speed)}`
          settings.push(formatted)
        }
        if (photo.exif.ISO && photo.exif.ISO !== '400') settings.push(`ISO ${photo.exif.ISO}`)
        
        if (settings.length > 0) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(settings.join(' • '), textPad, sizeConfig.height - textPad - fontSize * 0.2)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
        
        // Filename with better truncation
        ctx.textAlign = 'right'
        const maxLength = Math.floor(sizeConfig.width / (fontSize * 0.6))
        const name = photo.name.length > maxLength ? photo.name.substring(0, maxLength - 3) + '…' : photo.name
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
        ctx.shadowBlur = 1
        ctx.fillText(name.toUpperCase(), sizeConfig.width - textPad, sizeConfig.height - textPad - fontSize * 0.2)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        
        // Date
        if (photo.exif.DateTimeOriginal) {
          ctx.save()
          ctx.textAlign = 'center'
          ctx.translate(sizeConfig.width - textPad, sizeConfig.height / 2)
          ctx.rotate(-Math.PI / 2)
          
          const date = new Date(photo.exif.DateTimeOriginal)
          const formatted = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          
          ctx.fillText(formatted, 0, 0)
          ctx.restore()
        }
      }
      
      img.src = photo.imageUrl
    },

    savePrint(index) {
      const canvas = this.canvasRefs[index]
      
      if (!canvas) return
      
      const link = document.createElement('a')
      
      if (this.globalSettings.printSize === 'contact') {
        const date = new Date().toISOString().split('T')[0]
        link.download = `contact_sheet_${date}.png`
      } else {
        const photo = this.photos[index]
        link.download = `${photo.name.split('.')[0]}_print.png`
      }
      
      link.href = canvas.toDataURL('image/png')
      link.click()
    },

    async exportAll() {
      try {
        this.downloadStatus.isDownloading = true
        
        // Select directory with proper error handling
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
        console.error('Error during export:', error)
        alert(`Error during export: ${error.message || error}`)
        
        this.photos.forEach((photo, index) => {
          setTimeout(() => {
            this.savePrint(index)
          }, index * 100)
        })
      }
    },

    async openInFinder() {
      try {
        if (this.downloadStatus.lastDownloadPath) {
          await invoke('open_in_finder', { folderPath: this.downloadStatus.lastDownloadPath })
        }
      } catch (error) {
        console.error('Error opening in finder:', error)
      }
    },

    applyGlobalSettings() {
      this.$nextTick(() => {
        this.photos.forEach((photo, index) => {
          this.generatePrint(index)
        })
        
        // Also update contact sheet if we're in contact mode
        if (this.globalSettings.printSize === 'contact') {
          this.regenerateContactSheet()
        }
      })
    },

    async importFiles() {
      try {
        this.isProcessingFiles = true
        const filePaths = await invoke('import_files')
          
        for (const filePath of filePaths) {
          const photo = await this.processPhotoFromPath(filePath)
          if (photo) {
            this.photos.push(photo)
          }
        }
        // Generate all canvases after all photos are added
        this.$nextTick(() => {
          this.applyGlobalSettings()
        })
        this.saveToLocalStorage()
        this.isProcessingFiles = false
      } catch (error) {
        this.isProcessingFiles = false
        console.error('Error importing files:', error)
        alert(`Error importing files: ${error}`)
        
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
          // Generate all canvases after all photos are added
          this.$nextTick(() => {
            this.applyGlobalSettings()
          })
          this.saveToLocalStorage()
        }
        
        input.click()
      }
    },

    async importFolder() {
      try {
        this.isProcessingFiles = true
        const filePaths = await invoke('import_folder')
          
        for (const filePath of filePaths) {
          const photo = await this.processPhotoFromPath(filePath)
          if (photo) {
            this.photos.push(photo)
          }
        }
        // Generate all canvases after all photos are added
        this.$nextTick(() => {
          this.applyGlobalSettings()
        })
        this.saveToLocalStorage()
        this.isProcessingFiles = false
      } catch (error) {
        this.isProcessingFiles = false
        console.error('Error importing folder:', error)
        alert(`Error importing folder: ${error}`)
        
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
          // Generate all canvases after all photos are added
          this.$nextTick(() => {
            this.applyGlobalSettings()
          })
          this.saveToLocalStorage()
        }
        
        input.click()
      }
    },

    removePhoto(index) {
      this.photos.splice(index, 1)
      // Clear the canvas ref for the removed photo
      this.canvasRefs.splice(index, 1)
      this.saveToLocalStorage()
    },

    togglePreviewPane() {
      if (this.previewPane.isVisible && this.photos.length > 0 && this.previewPane.selectedPhotoIndex === null) {
        this.previewPane.selectedPhotoIndex = 0
        this.$nextTick(() => {
          this.updatePreview()
        })
      }
    },

    selectPhotoForPreview(index) {
      this.previewPane.selectedPhotoIndex = index
      // Only update preview if pane is already visible
      if (this.previewPane.isVisible) {
        this.$nextTick(() => {
          this.updatePreview()
        })
      }
    },

    async updatePreview() {
      if (this.previewPane.selectedPhotoIndex === null) return
      
      const previewCanvas = this.$refs.previewCanvas
      if (!previewCanvas) return

      // Use the same generation logic as the main canvas
      if (this.globalSettings.printSize === 'contact') {
        // Contact sheet preview not implemented for now
        return
      } else if (this.isVideoFormat(this.globalSettings.printSize)) {
        await this.generateVideoFormat(this.previewPane.selectedPhotoIndex, previewCanvas)
      } else {
        await this.generatePrintForCanvas(this.previewPane.selectedPhotoIndex, previewCanvas)
      }
    },

    async generatePrintForCanvas(index, targetCanvas) {
      const photo = this.photos[index]
      if (!photo || !targetCanvas) return

      const ctx = targetCanvas.getContext('2d')
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
        
        // Text padding is fixed near edge, image margin is adjustable
        const textPad = 30 // Text always near edge
        const fontSize = Math.floor((sizeConfig.width / 100) * this.globalSettings.textSize)
        const minMargin = textPad + fontSize * 1.5 // Minimum to ensure text is visible
        const requestedMargin = this.globalSettings.marginSize || (this.globalSettings.commercialPrintSafe ? 180 : 90)
        const imageMargin = Math.max(minMargin, requestedMargin)
        const imageArea = {
          x: imageMargin,
          y: imageMargin,
          width: sizeConfig.width - (imageMargin * 2),
          height: sizeConfig.height - (imageMargin * 2)
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
          // Refined border with subtle shadow effect
          ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          
          ctx.strokeStyle = '#000000'
          ctx.lineWidth = 6 // Slightly thinner, more elegant
          ctx.strokeRect(drawX - 3, drawY - 3, drawWidth + 6, drawHeight + 6)
          
          // Reset shadow
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        }
        
        // EXIF text with refined styling
        ctx.fillStyle = '#1a1a1a' // Darker, more readable
        ctx.font = `${fontSize}px 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace`
        ctx.textBaseline = 'alphabetic'

        // Camera info with refined typography
        ctx.textAlign = 'left'
        const camera = [photo.exif.Make, photo.exif.Model].filter(Boolean).join(' ')
        if (camera && camera !== 'Unknown Camera') {
          // Add subtle text shadow for better readability
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(camera.toUpperCase(), textPad, textPad + fontSize * 0.8)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }

        // Lens info
        ctx.textAlign = 'right'
        if (photo.exif.LensModel) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(photo.exif.LensModel.toUpperCase(), sizeConfig.width - textPad, textPad + fontSize * 0.8)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
        
        // Settings with improved formatting
        ctx.textAlign = 'left'
        const settings = []
        if (photo.exif.FocalLength && photo.exif.FocalLength !== '50') settings.push(`${photo.exif.FocalLength}mm`)
        if (photo.exif.FNumber && photo.exif.FNumber !== '5.6') settings.push(`ƒ${photo.exif.FNumber}`)
        if (photo.exif.ExposureTime && photo.exif.ExposureTime !== '1/60') {
          const speed = parseFloat(photo.exif.ExposureTime)
          const formatted = speed >= 1 ? `${Math.round(speed)}s` : `1/${Math.round(1/speed)}`
          settings.push(formatted)
        }
        if (photo.exif.ISO && photo.exif.ISO !== '400') settings.push(`ISO ${photo.exif.ISO}`)
        
        if (settings.length > 0) {
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
          ctx.shadowBlur = 1
          ctx.fillText(settings.join(' • '), textPad, sizeConfig.height - textPad - fontSize * 0.2)
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
        }
        
        // Filename with better truncation
        ctx.textAlign = 'right'
        const maxLength = Math.floor(sizeConfig.width / (fontSize * 0.6))
        const name = photo.name.length > maxLength ? photo.name.substring(0, maxLength - 3) + '…' : photo.name
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
        ctx.shadowBlur = 1
        ctx.fillText(name.toUpperCase(), sizeConfig.width - textPad, sizeConfig.height - textPad - fontSize * 0.2)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        
        // Date
        if (photo.exif.DateTimeOriginal) {
          ctx.save()
          ctx.textAlign = 'center'
          ctx.translate(sizeConfig.width - textPad, sizeConfig.height / 2)
          ctx.rotate(-Math.PI / 2)
          
          const date = new Date(photo.exif.DateTimeOriginal)
          const formatted = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(-2)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          
          ctx.fillText(formatted, 0, 0)
          ctx.restore()
        }
      }
      
      img.src = photo.imageUrl
    },

    saveToLocalStorage() {
      try {
        const dataToSave = {
          photos: this.photos.map(photo => ({
            ...photo,
            // Don't save the File object or blob URLs for web, but keep filePath for Tauri
            file: undefined,
            imageUrl: photo.filePath ? undefined : photo.imageUrl // Keep blob URL only if no filePath
          })),
          globalSettings: this.globalSettings,
          previewPane: this.previewPane
        }
        localStorage.setItem('exif-printer-data', JSON.stringify(dataToSave))
      } catch (error) {
        console.warn('Failed to save to localStorage:', error)
      }
    },

    async loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem('exif-printer-data')
        if (!saved) return

        const data = JSON.parse(saved)
        
        // Restore settings
        if (data.globalSettings) {
          this.globalSettings = { ...this.globalSettings, ...data.globalSettings }
        }
        
        if (data.previewPane) {
          this.previewPane = { ...this.previewPane, ...data.previewPane }
        }

        // Restore photos
        if (data.photos && data.photos.length > 0) {
          for (const photoData of data.photos) {
            let restoredPhoto = null
            
            // Try to restore from file path first (Tauri)
            if (photoData.filePath) {
              try {
                restoredPhoto = await this.processPhotoFromPath(photoData.filePath)
                if (restoredPhoto) {
                  // Preserve custom caption
                  if (photoData.customCaption) {
                    restoredPhoto.customCaption = photoData.customCaption
                  }
                }
              } catch (error) {
                console.warn('Could not restore photo from path:', photoData.filePath, error)
              }
            }
            
            // Fallback: restore from saved data (web/blob URLs)
            if (!restoredPhoto && photoData.imageUrl) {
              restoredPhoto = {
                ...photoData,
                id: Date.now() + Math.random() // Generate new ID
              }
            }
            
            if (restoredPhoto) {
              this.photos.push(restoredPhoto)
            }
          }
          
          // Generate canvases for restored photos  
          this.$nextTick(() => {
            // Wait a bit more for DOM to be ready
            setTimeout(() => {
              this.applyGlobalSettings()
            }, 100)
          })
        }
      } catch (error) {
        console.warn('Failed to load from localStorage:', error)
      }
    },

    clearAllPhotos() {
      if (confirm('Remove all photos?')) {
        this.photos = []
        this.skeletonPhotos = []
        this.canvasRefs = []
        this.downloadStatus.lastDownloadPath = null
        this.downloadStatus.downloadCount = 0
        this.processingCount = 0
        this.previewPane.selectedPhotoIndex = null
        this.saveToLocalStorage() // Clear from storage too
      }
    },

    getDropZoneText() {
      if (this.isProcessingFiles) {
        return ` Processing ${this.processingCount} photos...`
      }
      if (this.isDragOver) {
        return '📁 Drop photos here'
      }
      return '📷 Drop photos'
    },

    async regenerateContactSheet() {
      const canvas = this.canvasRefs[0]
      if (!canvas || this.photos.length === 0) return

      await this.generateContactSheet(canvas, this.photos, {
        showFilenames: this.globalSettings.showFilenames,
        showExif: this.globalSettings.showExif,
        margin: this.globalSettings.marginSize || (this.globalSettings.commercialPrintSafe ? 180 : 40),
        spacing: 12,
        fontSize: 10
      })
    },

    saveContactSheet() {
      const canvas = this.canvasRefs[0]
      if (!canvas) return

      const link = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      link.download = `contact_sheet_${date}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }
}
</script>