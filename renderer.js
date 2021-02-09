// Requires
const {
  ipcRenderer
} = require('electron');
const fs = require('fs');
const path = require('path');
var pro6 = require('./lib/editPro6');
var pro7 = require('./lib/editPro7');

let curFunction = '';
let notification = {
  title: 'ProPresenter Suite', // Fallback
  body: ''
};

// Text fields
let fileLang1 = document.getElementById('fileLang1Field');
let fileLang2 = document.getElementById('fileLang2Field');

// Buttons
const browseLang1 = document.getElementById('browseLang1');
const browseLang2 = document.getElementById('browseLang2');
const mergeLangBtn = document.getElementById('mergeLangBtn');
const switchLangBtn = document.getElementById('switchLangBtn');
const fillNotesBtn = document.getElementById('fillNotesBtn');

// Open file dialogs
browseLang1.addEventListener('click', (event) => {
  curFunction = 'browseLang1';
  ipcRenderer.send('open-file-dialog');
});

browseLang2.addEventListener('click', (event) => {
  curFunction = 'browseLang2';
  ipcRenderer.send('open-file-dialog');
});

switchLangBtn.addEventListener('click', (event) => {
  curFunction = 'switchLang';
  ipcRenderer.send('open-file-dialog', 'multiSelections');
});

fillNotesBtn.addEventListener('click', (event) => {
  curFunction = 'fillNotes';
  ipcRenderer.send('open-file-dialog', 'multiSelections');
});

// Process selected files from main process
ipcRenderer.on('selected-files', (event, files) => {
  switch (curFunction) {
    case 'browseLang1':
      fileLang1.value = files;
      if (fileLang2Field.value != '') {
        mergeLangBtn.disabled = false;
      }
      break;
    case 'browseLang2':
      fileLang2.value = files;
      if (fileLang1Field.value != '') {
        mergeLangBtn.disabled = false;
      }
      break;
    case 'switchLang':
      ipcRenderer.send('log', 'Files to process: ' + files.length);
      files.forEach(file => {
        if (path.extname(file) === '.pro') {
          pro7.switchLanguages(file)
            .then(message => {
              notification.body = message;
              const myNotification = new window.Notification('Languages switched', notification);
            })
            .catch(error => ipcRenderer.send('open-error-dialog', error));
        } else {
          pro6.switchLanguages(file)
            .then(message => {
              notification.body = message;
              const myNotification = new window.Notification('Languages switched', notification);
            })
            .catch(error => ipcRenderer.send('open-error-dialog', error));
        }
      });
      break;
    case 'fillNotes':
      ipcRenderer.send('log', 'Files to process: ' + files.length);
      files.forEach(file => {
        if (path.extname(file) === '.pro') {
          pro7.fillNotes(file)
            .then(message => {
              notification.body = message;
              const myNotification = new window.Notification('Notes filled', notification);
            })
            .catch(error => ipcRenderer.send('open-error-dialog', error));
        } else {
          pro6.fillNotes(file)
            .then(message => {
              notification.body = message;
              const myNotification = new window.Notification('Notes filled', notification);
            })
            .catch(error => ipcRenderer.send('open-error-dialog', error));
        }
      });
  }
});

// Start merging languages
mergeLangBtn.addEventListener('click', (event) => {
  if (path.extname(fileLang1.value) !== path.extname(fileLang2.value)) throw "File types don't match";

  if (path.extname(fileLang1.value) === '.pro') {
    pro7.mergeLanguages(fileLang1.value, fileLang2.value)
      .then(message => {
        notification.body = message;
        const myNotification = new window.Notification('Languages merged', notification);
      })
      .catch(error => ipcRenderer.send('open-error-dialog', error));
  } else {
    pro6.mergeLanguages(fileLang1.value, fileLang2.value)
      .then(message => {
        notification.body = message;
        const myNotification = new window.Notification('Languages merged', notification);
      })
      .catch(error => ipcRenderer.send('open-error-dialog', error));
  }
});
