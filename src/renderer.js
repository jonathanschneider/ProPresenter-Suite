// Requires
const {
  ipcRenderer
} = require('electron');
const fs = require('fs');
const path = require('path');
var pro6 = require('./editPro6');
var pro7 = require('./editPro7');

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

// Fill notes
fillNotesBtn.addEventListener('click', (event) => {
  files = ipcRenderer.sendSync('open-file-dialog', 'multiSelections');

  if (files !== undefined) {
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

// Merge two languages

// Select first file
browseLang1.addEventListener('click', (event) => {
  file = ipcRenderer.sendSync('open-file-dialog');

  if (file !== undefined) fileLang1.value = file;
  if (fileLang2Field.value !== '') {
    mergeLangBtn.disabled = false;
  }
});

// Select second file
browseLang2.addEventListener('click', (event) => {
  file = ipcRenderer.sendSync('open-file-dialog');

  if (file !== undefined) fileLang2.value = file;
  if (fileLang2Field.value !== '') mergeLangBtn.disabled = false;
});

// Start merging languages
mergeLangBtn.addEventListener('click', (event) => {
  if (path.extname(fileLang1.value) !== path.extname(fileLang2.value)) throw "File types don't match";

  if (path.extname(fileLang1.value) === '.pro') {
    pro7.mergeLanguages([fileLang1.value, fileLang2.value])
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

// Switch languages
switchLangBtn.addEventListener('click', (event) => {
  files = ipcRenderer.sendSync('open-file-dialog', 'multiSelections');

  if (files !== undefined) {
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
  }
});
