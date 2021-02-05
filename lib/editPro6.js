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

// Functions
async function mergeLangMain(pathToFile1, pathToFile2) {
  // Read files
  const file1 = fs.readFileSync(pathToFile1, 'utf8');
  const file2 = fs.readFileSync(pathToFile2, 'utf8');

  try {
    // Parse files
    let parsedFiles = await Promise.all([parseFile(file1), parseFile(file2)]);

    newFile = mergeLang(parsedFiles); // Loop through slides and change order of text elements
    newFile = buildXML(newFile); // Re-build XML
    // Write file
    fs.writeFile(path.resolve(pathToFile1), newFile, function(err) {
      if (err) throw err;
      ipcRenderer.send('log', path.basename(pathToFile1) + " saved");
      notification.body = 'Sprachen wurden in ' + path.basename(pathToFile1) + ' zusammengeführt';
      const myNotification = new window.Notification(notification.title, notification);
    });
  } catch (error) {
    ipcRenderer.send('open-error-dialog', error);
    ipcRenderer.send('log', "Error: " + error);
  }
}

function mergeLang(files) {
  ipcRenderer.send('log', 'Started merging');

  // Check if documents have same number of groups
  if (files[0].RVPresentationDocument.array[0].RVSlideGrouping.length != files[1].RVPresentationDocument.array[0].RVSlideGrouping.length) {
    throw "Documents don't have the same number of groups";
  }

  // Loop through all groups of document 1
  files[0].RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {
    // Check if slides exist, otherwise abort
    if ((!currentGroup.array[0].hasOwnProperty("RVDisplaySlide")) || !files[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].hasOwnProperty("RVDisplaySlide")) {
      throw "At least one document doesn't have any slides";
    } else if (currentGroup.array[0].RVDisplaySlide.length != files[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide.length) {
      throw "Documents don't have the same number of slides";
    }

    //ipcRenderer.send('log', "Processing group " + indexGroup + " with " + currentGroup.array[0].RVDisplaySlide.length + " slide(s)");

    // Loop through all slides
    currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {
      if (currentSlide.array[1].hasOwnProperty("RVTextElement") &
        files[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide[indexSlide].array[1].hasOwnProperty("RVTextElement")) {
        // Append text element from document 2
        currentSlide.array[1].RVTextElement.push(files[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide[indexSlide].array[1].RVTextElement[0]);
        currentSlide.array[1].RVTextElement[0].$.displayName = 'Main';
        currentSlide.array[1].RVTextElement[1].$.displayName = 'Translation';
      }
    });
  });
  ipcRenderer.send('log', "Languages merged");
  return files[0];
}

async function switchLang(pathToFile) {
  try {
    let newFile = await parseFile(fs.readFileSync(pathToFile, 'utf8')); // Read and parse file
    newFile = changeOrder(newFile); // Loop through slides and change order of text elements
    newFile = await fillNotes(newFile);
    newFile = buildXML(newFile); // Re-build XML
    // Write file
    fs.writeFile(path.resolve(pathToFile), newFile, function(err) {
      if (err) throw err;
      ipcRenderer.send('log', path.basename(pathToFile) + " saved");
      notification.body = 'Sprachen in ' + path.basename(pathToFile) + ' wurden getauscht';
      const myNotification = new window.Notification(notification.title, notification);
    });
  } catch (error) {
    ipcRenderer.send('open-error-dialog', error);
    ipcRenderer.send('log', "Error: " + error);
  }
}

function changeOrder(file) {
  // Loop through all groups
  file.RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {

    // Check if slides exist, otherwise abort
    if (!currentGroup.array[0].hasOwnProperty("RVDisplaySlide")) {
      //ipcRenderer.send('log', "Document doesn't have any slides");
      throw "Document doesn't have any slides";
    }

    // Loop through all slides
    currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {
      if (currentSlide.array[1].hasOwnProperty("RVTextElement") &&
        currentSlide.array[1].RVTextElement.length == 2) {
        // Save string of top text element
        let string = currentSlide.array[1].RVTextElement[0].NSString[0];
        currentSlide.array[1].RVTextElement[0].NSString[0] = currentSlide.array[1].RVTextElement[1].NSString[0];
        currentSlide.array[1].RVTextElement[0].$.displayName = 'Main';
        currentSlide.array[1].RVTextElement[1].NSString[0] = string;
        currentSlide.array[1].RVTextElement[1].$.displayName = 'Translation';
      }
    });
  });
  ipcRenderer.send('log', "Languages switched");
  return file;
}

function mainFillNotes(pathToFile) {
  // Read file
  let file = fs.readFileSync(pathToFile, 'utf8');

  parseFile(file) // Parse file
    .then(fillNotes) // Fill notes
    .then(function(newFile) {
      newFile = buildXML(newFile); // Re-build XML
      // Write file
      fs.writeFile(path.resolve(pathToFile), newFile, function(err) {
        if (err) throw err;
        ipcRenderer.send('log', path.basename(pathToFile) + " saved");
        notification.body = 'Notizen in ' + path.basename(pathToFile) + ' wurden gefüllt';
        const myNotification = new window.Notification(notification.title, notification);
      });
    })
    .catch(function(error) {
      ipcRenderer.send('open-error-dialog', error);
      ipcRenderer.send('log', "Error: " + error);
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
      throw "Document doesn't have any slides";
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
  Promise.all(promises);
  return promises[promises.length - 1]; // Actual file is in last element of Promise array
}

// Parse file
function parseFile(file) {
  return new Promise((resolve, reject) => {
    parser.parseString(file, function(err, result) {
      if (err) {
        ipcRenderer.send('log', "Error during parsing");
        reject(err);
      } else {
        ipcRenderer.send('log', "File parsed");
        resolve(result);
      }
    });
  });
}

// async function parseFile2(file) {
//   try {
//     let parsedFile = await parser.parseString(file);
//     ipcRenderer.send('log', "File parsed with parseFile2");
//     return parsedFile;
//   } catch (error) {
//     ipcRenderer.send('open-error-dialog', error);
//     ipcRenderer.send('log', error);
//   }
// }

// Build XML file
function buildXML(file) {
  ipcRenderer.send('log', "XML rebuilt");
  return builder.buildObject(file);
}

exports.fillNotes = mainFillNotes;
exports.mergeLanguages = mergeLangMain;
exports.switchLanguages = switchLang;
