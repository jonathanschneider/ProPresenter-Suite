// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog
} = require('electron');

//handle setupevents as quickly as possible
const setupEvents = require('./installers/setupEvents');

if (setupEvents.handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 700,
    height: 530,
    useContentSize: true,
    minWidth: 700,
    minHeight: 530,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// Create main window when Electron has finished initialization
app.on('ready', createWindow);

// Open file dialog upon request
ipcMain.on('open-file-dialog', (event, selection) => {
  event.returnValue = dialog.showOpenDialogSync({
    properties: ['openFile', selection],
    filters: [{
      name: 'text',
      extensions: ['pro6', 'pro']
    }]
  });
});

// Show error messages
ipcMain.on('open-error-dialog', (event, error) => {
  console.error('Error:', error); // Log for developing purposes
  dialog.showErrorBox('Oops! Something went wrong!', error);
});

// Log messages to console for debugging
ipcMain.on('log', (event, message) => {
  console.log(message);
});

ipcMain.on('quit', (event) => {
  app.quit();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  app.quit();
});
