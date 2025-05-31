import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri APIs
const mockInvoke = vi.fn()
const mockListen = vi.fn()

// Mock window.__TAURI__
Object.defineProperty(window, '__TAURI__', {
  value: {
    tauri: { invoke: mockInvoke },
    event: { listen: mockListen }
  },
  writable: true
})

// Type assertion for tests - we know it's defined in our mocks

describe('Tauri Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('File Import Commands', () => {
    it('should invoke import_files command', async () => {
      const mockFilePaths = ['/path/to/photo1.jpg', '/path/to/photo2.png']
      mockInvoke.mockResolvedValue(mockFilePaths)

      const result = await window.__TAURI__!.tauri.invoke('import_files')
      
      expect(mockInvoke).toHaveBeenCalledWith('import_files')
      expect(result).toEqual(mockFilePaths)
    })

    it('should invoke import_folder command', async () => {
      const mockFilePaths = ['/folder/image1.jpg', '/folder/image2.jpg']
      mockInvoke.mockResolvedValue(mockFilePaths)

      const result = await window.__TAURI__!.tauri.invoke('import_folder')
      
      expect(mockInvoke).toHaveBeenCalledWith('import_folder')
      expect(result).toEqual(mockFilePaths)
    })

    it('should invoke read_file_as_bytes command', async () => {
      const mockBytes = new Uint8Array([255, 216, 255, 224]) // JPEG header
      mockInvoke.mockResolvedValue(Array.from(mockBytes))

      const result = await window.__TAURI__!.tauri.invoke('read_file_as_bytes', { 
        filePath: '/path/to/photo.jpg' 
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('read_file_as_bytes', { 
        filePath: '/path/to/photo.jpg' 
      })
      expect(result).toEqual(Array.from(mockBytes))
    })
  })

  describe('Directory Selection', () => {
    it('should invoke select_directory command', async () => {
      const mockDirectory = '/Users/test/Downloads'
      mockInvoke.mockResolvedValue(mockDirectory)

      const result = await window.__TAURI__!.tauri.invoke('select_directory')
      
      expect(mockInvoke).toHaveBeenCalledWith('select_directory')
      expect(result).toBe(mockDirectory)
    })

    it('should handle cancelled directory selection', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await window.__TAURI__!.tauri.invoke('select_directory')
      
      expect(result).toBeNull()
    })
  })

  describe('File Download', () => {
    it('should invoke download_files command with correct parameters', async () => {
      const mockFiles = [
        { filename: 'photo1_print.png', dataURL: 'data:image/png;base64,abc123' },
        { filename: 'photo2_print.png', dataURL: 'data:image/png;base64,def456' }
      ]
      const mockDirectory = '/Users/test/Downloads'
      const mockResult = { success: true, count: 2, directory: mockDirectory }
      
      mockInvoke.mockResolvedValue(mockResult)

      const result = await window.__TAURI__!.tauri.invoke('download_files', {
        files: mockFiles,
        directory: mockDirectory
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('download_files', {
        files: mockFiles,
        directory: mockDirectory
      })
      expect(result).toEqual(mockResult)
    })

    it('should handle download errors', async () => {
      const mockError = { success: false, error: 'Permission denied' }
      mockInvoke.mockResolvedValue(mockError)

      const result = await window.__TAURI__!.tauri.invoke('download_files', {
        files: [],
        directory: '/invalid/path'
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
    })
  })

  describe('Event Listeners', () => {
    it('should set up drag-drop event listener', async () => {
      const mockUnlisten = vi.fn()
      mockListen.mockResolvedValue(mockUnlisten)

      const handler = vi.fn()
      const unlisten = await window.__TAURI__!.event.listen('tauri://drag-drop', handler)
      
      expect(mockListen).toHaveBeenCalledWith('tauri://drag-drop', handler)
      expect(unlisten).toBe(mockUnlisten)
    })

    it('should set up drag-over event listener', async () => {
      const mockUnlisten = vi.fn()
      mockListen.mockResolvedValue(mockUnlisten)

      const handler = vi.fn()
      const unlisten = await window.__TAURI__!.event.listen('tauri://drag-over', handler)
      
      expect(mockListen).toHaveBeenCalledWith('tauri://drag-over', handler)
      expect(unlisten).toBe(mockUnlisten)
    })
  })

  describe('System Integration', () => {
    it('should invoke open_in_finder command', async () => {
      const mockResult = { success: true }
      mockInvoke.mockResolvedValue(mockResult)

      const result = await window.__TAURI__!.tauri.invoke('open_in_finder', {
        folderPath: '/Users/test/Downloads'
      })
      
      expect(mockInvoke).toHaveBeenCalledWith('open_in_finder', {
        folderPath: '/Users/test/Downloads'
      })
      expect(result).toEqual(mockResult)
    })
  })

  describe('Error Handling', () => {
    it('should handle invoke command errors', async () => {
      const mockError = new Error('Command failed')
      mockInvoke.mockRejectedValue(mockError)

      await expect(
        window.__TAURI__!.tauri.invoke('invalid_command')
      ).rejects.toThrow('Command failed')
    })

    it('should handle event listener setup errors', async () => {
      const mockError = new Error('Event setup failed')
      mockListen.mockRejectedValue(mockError)

      await expect(
        window.__TAURI__!.event.listen('invalid://event', vi.fn())
      ).rejects.toThrow('Event setup failed')
    })
  })
})