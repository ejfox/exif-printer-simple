import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false // Don't show until ready
  })

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, files are in the app bundle
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    console.log('Loading file from:', indexPath)
    console.log('__dirname is:', __dirname)
    mainWindow.loadFile(indexPath)
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Set up the menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: 'EXIF Photo Printer',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

let selectedDownloadDirectory = null

// Handle save directory selection
ipcMain.handle('select-directory', async () => {
  console.log('Directory selection requested')
  
  try {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    const mainWindow = focusedWindow || BrowserWindow.getAllWindows()[0]
    
    if (!mainWindow) {
      throw new Error('No main window available')
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select folder to save prints',
      message: 'Choose where to save your photo prints'
    })
    
    console.log('Dialog result:', JSON.stringify(result, null, 2))
    
    if (result.canceled) {
      console.log('User cancelled directory selection')
      return null
    }
    
    if (!result.filePaths || result.filePaths.length === 0) {
      console.error('Dialog returned no paths - this indicates a system permission issue')
      throw new Error('Directory selection failed - check macOS permissions')
    }
    
    const selectedPath = result.filePaths[0]
    selectedDownloadDirectory = selectedPath
    console.log('Directory selected:', selectedPath)
    
    return selectedPath
    
  } catch (error) {
    console.error('Error in directory selection:', error)
    throw error
  }
})

// Handle batch download
ipcMain.handle('download-files', async (event, files) => {
  console.log('Download files requested, count:', files.length)
  console.log('Selected directory:', selectedDownloadDirectory)
  
  if (!selectedDownloadDirectory) {
    console.log('No directory selected - returning error')
    return { success: false, error: 'No directory selected' }
  }
  
  try {
    console.log('Starting file writes...')
    for (const file of files) {
      const base64Data = file.dataURL.replace(/^data:image\/png;base64,/, '')
      const filePath = path.join(selectedDownloadDirectory, file.filename)
      console.log('Writing file:', filePath)
      await fs.promises.writeFile(filePath, base64Data, 'base64')
      console.log('File written successfully:', file.filename)
    }
    console.log('All files written successfully')
    return { success: true, count: files.length, directory: selectedDownloadDirectory }
  } catch (error) {
    console.error('Error writing files:', error)
    return { success: false, error: error.message }
  }
})

// Handle opening folder in Finder/Explorer
ipcMain.handle('open-in-finder', async (event, folderPath) => {
  console.log('Opening in finder:', folderPath)
  try {
    // Use shell.openPath for opening folders directly (best practice on macOS)
    const errorMsg = await shell.openPath(folderPath)
    if (errorMsg) {
      console.error('Error opening folder:', errorMsg)
      return { success: false, error: errorMsg }
    }
    return { success: true }
  } catch (error) {
    console.error('Error opening folder:', error)
    return { success: false, error: error.message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})