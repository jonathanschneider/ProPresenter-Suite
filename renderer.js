// Requires
const {
  ipcRenderer
} = require('electron');
const fs = require('fs');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
const textract = require("textract");
const path = require("path");

var notification = {
  title: 'ProPresenter Suite',
  body: '',
  //icon: path.join(__dirname, './assets/images/pp-suite-icon.png')
};

let curFunction = "";
let fileLang1, fileLang2;

// Read buttons
const browseLang1 = document.getElementById('browseLang1');
const browseLang2 = document.getElementById('browseLang2');
const mergeLangBtn = document.getElementById('mergeLangBtn');
const switchLangBtn = document.getElementById('switchLangBtn');
const fillNotesBtn = document.getElementById('fillNotesBtn');

// Open file dialogs
browseLang1.addEventListener('click', (event) => {
  curFunction = "browseLang1";
  ipcRenderer.send('open-file-dialog');
});

browseLang2.addEventListener('click', (event) => {
  curFunction = "browseLang2";
  ipcRenderer.send('open-file-dialog');
});

switchLangBtn.addEventListener('click', (event) => {
  curFunction = "switchLang";
  ipcRenderer.send('open-file-dialog');
});

fillNotesBtn.addEventListener('click', (event) => {
  curFunction = "fillNotes";
  ipcRenderer.send('open-file-dialog');
});

// Process selected files from main process
ipcRenderer.on('selected-files', (event, files) => {
  switch (curFunction) {
    case "browseLang1":
      fileLang1 = files;
      break;
    case "browseLang2":
      fileLang2 = files;
      break;
    case "switchLang":
      ipcRenderer.send('log', "Files to process: " + files.length);
      files.forEach(function(pathToFile) {
        switchLang(pathToFile);
      });
      break;
    case "fillNotes":
      ipcRenderer.send('log', "Files to process: " + files.length);
      files.forEach(function(pathToFile) {
        mainFillNotes(pathToFile);
      });
  }
});

// Start merging languages
mergeLangBtn.addEventListener('click', (event) => {
  ;
});

// Functions
function mergeLang(pathToFile) {
  ;
}

function switchLang(pathToFile) {
  // Read file
  let file = fs.readFileSync(pathToFile, 'utf8');

  parseFile(file) // Parse file
    .then(changeOrder) // Loop through slides and change order of text elements
    .then(buildXML) // Re-build XML
    .then(function(newFile) {
      // Write file
      fs.writeFile(path.resolve(pathToFile), newFile, function(err) {
        if (err) throw err;
        ipcRenderer.send('log', path.basename(pathToFile) + " saved");
        notification.body = 'Sprachen in ' + path.basename(pathToFile) + ' wurden getauscht';
        const myNotification = new window.Notification(notification.title, notification);
      });
    })
    .catch(function(error) {
      ipcRenderer.send('log', "Error: " + error);
    });
}

function mainFillNotes(pathToFile) {
  // Read file
  let file = fs.readFileSync(pathToFile, 'utf8');

  parseFile(file) // Parse file
    .then(fillNotes) // Loop through slides and fill notes
    .then(buildXML) // Re-build XML
    .then(function(newFile) {
      // Write file
      fs.writeFile(path.resolve(pathToFile), newFile, function(err) {
        if (err) throw err;
        ipcRenderer.send('log', path.basename(pathToFile) + " saved");
        notification.body = 'Notizen in ' + path.basename(pathToFile) + ' wurden gefüllt';
        const myNotification = new window.Notification(notification.title, notification);
      });
    })
    .catch(function(error) {
      ipcRenderer.send('log', "Error: " + error);
    });
}

// Parse file
function parseFile(file) {
  //console.log("Parsing file");
  return new Promise((resolve, reject) => {
    parser.parseString(file, function(err, result) {
      if (err) {
        reject(err);
      } else {
        ipcRenderer.send('log', "File parsed");
        resolve(result);
      }
    });
  });
}

function changeOrder(file) {
  var promises = [];
  let string;
  var isLast;

  // Loop through all groups
  file.RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {

    // Check if slides exist, otherwise abort
    if (!currentGroup.array[0].hasOwnProperty("RVDisplaySlide")) {
      ipcRenderer.send('log', "Document doesn't have any slides");
      promises.push(file);
      return;
    }

    // Loop through all slides
    currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {

      var currentSlidesPromise = new Promise(function(resolve, reject) {

        // Check if current slide is last slide
        if ((indexGroup == file.RVPresentationDocument.array[0].RVSlideGrouping.length - 1) &&
          (indexSlide == currentGroup.array[0].RVDisplaySlide.length - 1)) {
          isLast = true;
        }

        if (currentSlide.array[1].hasOwnProperty("RVTextElement") &&
          currentSlide.array[1].RVTextElement.length == 2) {
          // Save string of top text element
          string = currentSlide.array[1].RVTextElement[0].NSString[0];
          currentSlide.array[1].RVTextElement[0].NSString[0] = currentSlide.array[1].RVTextElement[1].NSString[0];
          currentSlide.array[1].RVTextElement[0].$.displayName = 'Main';
          currentSlide.array[1].RVTextElement[1].NSString[0] = string;
          currentSlide.array[1].RVTextElement[1].$.displayName = 'Translation';

          // Resolve and return parsed file if current slide is last slide in document
          if (isLast) {
            resolve(file);
          } else { // Else only resolve without returning parsed file
            resolve();
          }
        } else { // Slide doesn't have two text elements
          // Resolve and return parsed file if current slide is last slide in document
          if (isLast) {
            resolve(file);
          } else { // Else only resolve without returning parsed file
            resolve();
          }
        }

      });
      promises.push(currentSlidesPromise);
    });
  });
  ipcRenderer.send('log', "Languages switched");
  return Promise.all(promises);
}

// Fill notes
function fillNotes(parsedFile) {
  var promises = [];
  var isLast;

  // Loop through all groups
  parsedFile.RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {

    // Check if slides exist, otherwise abort
    if (!currentGroup.array[0].hasOwnProperty("RVDisplaySlide")) {
      ipcRenderer.send('log', "Document doesn't have any slides");
      promises.push(parsedFile);
      return;
    }

    // Loop through all slides
    currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {

      var currentSlidesPromise = new Promise(function(resolve, reject) {

        // Check if current slide is last slide
        if ((indexGroup == parsedFile.RVPresentationDocument.array[0].RVSlideGrouping.length - 1) &&
          (indexSlide == currentGroup.array[0].RVDisplaySlide.length - 1)) {
          isLast = true;
        }

        if (currentSlide.array[1].hasOwnProperty("RVTextElement")) {
          // Decode RTF data
          var decodedText = Buffer.from(currentSlide.array[1].RVTextElement[0].NSString[0]._, 'base64');

          // Get text and write to notes
          textract.fromBufferWithMime('application/rtf', decodedText, {
            preserveLineBreaks: true
          }, function(error, text) {
            if (error) {
              reject(error);
            } else {
              // Filter place-holder
              if (text != 'Double-click to edit') {
                currentSlide.$.notes = text;
                //console.log(currentSlide.$.notes);
              }
              // Resolve and return parsed file if current slide is last slide in document
              if (isLast) {
                resolve(parsedFile);
              } else { // Else only resolve without returning parsed file
                resolve();
              }
            }
          });
        } else { // Slide doesn't have any text elements
          // Resolve and return parsed file if current slide is last slide in document
          if (isLast) {
            resolve(parsedFile);
          } else { // Else only resolve without returning parsed file
            resolve();
          }
        }

      });
      promises.push(currentSlidesPromise);
    });
  });
  ipcRenderer.send('log', "Notes filled");
  return Promise.all(promises);
}

// Build XML file
function buildXML(file) {
  // Promises of for-loop made parsedFile into array with undefined elements
  // Actual parsed file is stored in last element
  file = file[file.length - 1];
  var newFile = builder.buildObject(file);
  ipcRenderer.send('log', "XML rebuilt");
  return Promise.resolve(newFile);
}
