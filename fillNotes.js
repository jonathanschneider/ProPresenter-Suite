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
  title: 'ProPresenter Suite'
};

// Read button
const fillNotesBtn = document.getElementById('fillNotesBtn');

fillNotesBtn.addEventListener('click', (event) => {
  ipcRenderer.send('open-file-dialog');
});

// Fill notes
ipcRenderer.on('selected-files', (event, files) => {
  ipcRenderer.send('log', "Files to process: " + files.length);

  // Modify each file
  files.forEach(function(pathToFile, index) {
    // Read file
    var file = fs.readFileSync(pathToFile, 'utf8');

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
          //ipcRenderer.send('quit');
        });
      })
      .catch(function(error) {
        ipcRenderer.send('log', "Error: " + error);
      });
  });
});

// Functions

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
