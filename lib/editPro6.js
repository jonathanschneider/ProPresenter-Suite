const {
  ipcRenderer
} = require('electron');
const fs = require('fs');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
const textract = require('textract');
const path = require('path');

// Functions
async function mergeLang(pathToFile1, pathToFile2) {
  try {
    // Read files
    const file1 = fs.readFileSync(pathToFile1, 'utf8');
    const file2 = fs.readFileSync(pathToFile2, 'utf8');

    // Parse files
    let parsedFiles = await Promise.all([parseFile(file1), parseFile(file2)]);

    ipcRenderer.send('log', 'Started merging');

    // Check if documents have same number of groups
    if (parsedFiles[0].RVPresentationDocument.array[0].RVSlideGrouping.length != parsedFiles[1].RVPresentationDocument.array[0].RVSlideGrouping.length) {
      throw "Documents don't have the same number of groups";
    }

    // Loop through all groups of document 1
    parsedFiles[0].RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {
      // Check if slides exist, otherwise abort
      if ((!currentGroup.array[0].hasOwnProperty('RVDisplaySlide')) || !parsedFiles[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].hasOwnProperty('RVDisplaySlide')) {
        throw "At least one document doesn't have any slides";
      } else if (currentGroup.array[0].RVDisplaySlide.length != parsedFiles[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide.length) {
        throw "Documents don't have the same number of slides";
      }

      // Loop through all slides
      currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {
        if (currentSlide.array[1].hasOwnProperty('RVTextElement') &
          parsedFiles[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide[indexSlide].array[1].hasOwnProperty('RVTextElement')) {
          // Append text element from document 2
          currentSlide.array[1].RVTextElement.push(parsedFiles[1].RVPresentationDocument.array[0].RVSlideGrouping[indexGroup].array[0].RVDisplaySlide[indexSlide].array[1].RVTextElement[0]);
          currentSlide.array[1].RVTextElement[0].$.displayName = 'Main';
          currentSlide.array[1].RVTextElement[1].$.displayName = 'Translation';
        }
      });
    });
    ipcRenderer.send('log', 'Languages merged');

    newFile = buildXML(parsedFiles[0]); // Re-build XML

    let newPathToFile = pathToFile1.replace('.pro6', ' (merged).pro6');
    writeFile(newPathToFile, newFile); // Write file
    return Promise.resolve('File saved as "' + path.basename(newPathToFile) + '"');

  } catch (error) {
    return Promise.reject(error);
  }
}

async function switchLang(pathToFile) {
  try {
    let file = await parseFile(fs.readFileSync(pathToFile, 'utf8')); // Read and parse file

    // Loop through all groups
    file.RVPresentationDocument.array[0].RVSlideGrouping.forEach(function(currentGroup, indexGroup) {

      // Check if slides exist, otherwise throw error
      if (!currentGroup.array[0].hasOwnProperty('RVDisplaySlide')) throw "Document doesn't have any slides";

      // Loop through all slides
      currentGroup.array[0].RVDisplaySlide.forEach(function(currentSlide, indexSlide) {
        if (currentSlide.array[1].hasOwnProperty('RVTextElement') &&
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

    ipcRenderer.send('log', 'Languages switched');

    file = await fillNotes(file); // Fill notes
    file = buildXML(file); // Re-build XML

    let newPathToFile = pathToFile.replace('.pro6', ' (switched).pro6');
    writeFile(newPathToFile, file);
    return Promise.resolve('File saved as "' + path.basename(pathToFile) + '"');

  } catch (error) {
    return Promise.reject(error);
  }
}

async function mainFillNotes(pathToFile) {
  try {
    let file = fs.readFileSync(pathToFile, 'utf8'); // Read file
    file = await parseFile(file); // Parse file
    file = await fillNotes(file); // Fill notes
    file = buildXML(file); // Re-build XML
    writeFile(pathToFile, file); // Write file
    return Promise.resolve('File saved as "' + path.basename(pathToFile) + '"');
  } catch (error) {
    return Promise.reject(error);
  }
}

// Fill notes
async function fillNotes(file) {
  // Loop through all groups
  for (const group of file.RVPresentationDocument.array[0].RVSlideGrouping) {

    // Check if slides exist, otherwise throw error
    if (!group.array[0].hasOwnProperty('RVDisplaySlide')) throw "Document doesn't have any slides";

    // Loop through all slides
    for (const slide of group.array[0].RVDisplaySlide) {
      if (slide.array[1].hasOwnProperty('RVTextElement')) {
        // Get text from RTF
        let text = await getText(slide.array[1].RVTextElement[0].NSString[0]._);

        // Write to notes
        if (text != 'Double-click to edit') {
          slide.$.notes = text;
          //console.log(currentSlide.$.notes);
        }
      }
    }
  }

  ipcRenderer.send('log', 'Notes filled');
  return (file);
}

// Parse file
function parseFile(file) { // Promisify XML parser
  return new Promise((resolve, reject) => {
    parser.parseString(file, function(err, result) {
      if (err) {
        ipcRenderer.send('log', 'Error during parsing');
        reject(err);
      } else {
        ipcRenderer.send('log', 'File parsed');
        resolve(result);
      }
    });
  });
}

function getText(data) { // Promisify RTF parser
  return new Promise((resolve, reject) => {
    let buffer = Buffer.from(data, 'base64'); // Turn into buffer for textract
    textract.fromBufferWithMime('application/rtf', buffer, {
      preserveLineBreaks: true
    }, function(error, text) {
      if (error) {
        reject(error);
      } else {
        resolve(text);
      }
    });
  });
}

// Build XML file
function buildXML(file) {
  ipcRenderer.send('log', 'XML rebuilt');
  return builder.buildObject(file);
}

// Write file
function writeFile(pathToFile, file) {
  try {
    fs.writeFileSync(path.resolve(pathToFile), file);
  } catch (error) {
    ipcRenderer.send('log', error);
    throw "Error writing file";
  }
  ipcRenderer.send('log', 'File saved as "' + path.basename(pathToFile) + '"');
}

exports.fillNotes = mainFillNotes;
exports.mergeLanguages = mergeLang;
exports.switchLanguages = switchLang;
