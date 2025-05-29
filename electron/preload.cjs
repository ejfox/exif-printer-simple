const { contextBridge, ipcRenderer } = require('electron')

console.log('Preload script loaded!')
console.log('Context isolated:', process.contextIsolated)

const electronAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  downloadFiles: (files) => ipcRenderer.invoke('download-files', files),
  openInFinder: (path) => ipcRenderer.invoke('open-in-finder', path)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
    console.log('electronAPI exposed via contextBridge')
  } catch (error) {
    console.error('Failed to expose electronAPI via contextBridge:', error)
  }
} else {
  // Fallback for when context isolation is disabled
  window.electronAPI = electronAPI
  console.log('electronAPI exposed via window (fallback)')
}