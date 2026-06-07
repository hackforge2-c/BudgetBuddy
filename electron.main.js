const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, globalShortcut, shell } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let tray

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#fdf8f6',
    show: false,
    icon: path.join(__dirname, 'public', 'hero-bg.png'),
    webPreferences: {
      preload: path.join(__dirname, 'electron.preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Custom menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: '➕ Add Expense', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('shortcut', 'add-expense') },
        { label: '📤 Reports', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('shortcut', 'reports') },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: '📊 Dashboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow.webContents.send('shortcut', 'tab-dashboard') },
        { label: '💳 EMI & Loans', accelerator: 'CmdOrCtrl+2', click: () => mainWindow.webContents.send('shortcut', 'tab-emi') },
        { label: '🤝 Lent Money', accelerator: 'CmdOrCtrl+3', click: () => mainWindow.webContents.send('shortcut', 'tab-lent') },
        { type: 'separator' },
        { label: '👁️ Toggle Blur', accelerator: 'CmdOrCtrl+B', click: () => mainWindow.webContents.send('shortcut', 'toggle-blur') },
        { label: '🔐 Security', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.webContents.send('shortcut', 'security') },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { label: 'Toggle Fullscreen', role: 'togglefullscreen' },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'undo' },{ role: 'redo' },{ type:'separator' },{ role: 'cut' },{ role: 'copy' },{ role: 'paste' },{ role: 'selectAll' }] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('will-quit', () => globalShortcut.unregisterAll())
