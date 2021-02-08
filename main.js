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
    height: 550,
  });

  // and load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

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
  dialog.showOpenDialog({
    properties: ['openFile', selection],
    filters: [{
      name: 'text',
      extensions: ['pro6', 'pro']
    }]
  }, (files) => {
    if (files) {
      event.sender.send('selected-files', files);
    }
  });
});

// Show error messages
ipcMain.on('open-error-dialog', (event, message) => {
  dialog.showErrorBox('Oops! Something went wrong!', message);
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
