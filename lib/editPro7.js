const ipc = require('electron').ipcRenderer;
const fs = require('fs');
const path = require('path');
var protobuf = require('protobufjs');
const textract = require('textract');

const notesStyle = '{\\rtf1\\ansi\\ansicpg1252\\cocoartf2577\n\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n{\\colortbl;\\red255\\green255\\blue255;\\red0\\green0\\blue0;}\n{\\*\\expandedcolortbl;;\\cssrgb\\c0\\c0\\c0\\cname textColor;}\n\\pard\\tx560\\tx1120\\tx1680\\tx2240\\tx2800\\tx3360\\tx3920\\tx4480\\tx5040\\tx5600\\tx6160\\tx6720\\pardirnatural\\partightenfactor0\n\n\\f0\\fs24 \\cf2 ';
var Presentation;

// For testing from CLI
try {
  fillNotes(process.argv[2]);
} catch (error) {
  console.error(error);
}

async function fillNotes(pathToFile) {
  var presentation = await readFile(pathToFile);
  console.log('Editing file', path.basename(pathToFile));

  if (presentation.cues === undefined) throw 'Presentation doesn\'t contain any slides'; // Check if presentation contains any slides

  for (const cue of presentation.cues) { // forEach doesn't consider await, use for instead
    for (const action of cue.actions) {
      // Filter slides with text
      if (action.type === 'ACTION_TYPE_PRESENTATION_SLIDE' && action.slide.presentation.baseSlide.elements !== undefined) {
        console.log('Processing slide', );

        // Get text from RTF
        text = await getText(action.slide.presentation.baseSlide.elements[0].element.text.rtfData);

        // Reassemble RTF for notes
        let buffer = Buffer.from(notesStyle + text + '}'); // Encode base64
        action.slide.presentation.notes = {
          'rtfData': buffer.toString('base64')
        };
      }
    }
  }

  writeFile(pathToFile, presentation);
}

async function mergeLanguages(pathToFile) {
  var presentation = await readFile(pathToFile);
  console.log('Editing file', path.basename(pathToFile));

  writeFile(pathToFile, presentation);
}

async function switchLanguages(pathToFile) {
  var presentation = await readFile(pathToFile);
  console.log('Editing file', path.basename(pathToFile));

  writeFile(pathToFile, presentation);
}

function readFile(pathToFile) {
  return new Promise(resolve => {
    console.log('Reading file', path.basename(pathToFile));
    let buffer = fs.readFileSync(pathToFile);
    //ipcRenderer.send('log', 'Buffer: ' + buffer);

    protobuf.load('proto/presentation.proto', function(error, root) {
      if (error) {
        console.log(error);
        //ipcRenderer.send('log', err);
        throw error;
      }

      // Obtain message type
      Presentation = root.lookupType('rv.data.Presentation');

      // Decode buffer
      let message = Presentation.decode(buffer);

      // Convert to object
      let object = Presentation.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
      });
      resolve(object);
    });
  });
}

function writeFile(pathToFile, object) {
  return new Promise(resolve => {
    console.log('Writing to file', path.basename(pathToFile));

    // Convert to message
    let message = Presentation.fromObject(object);

    // Encode message to buffer
    let buffer = Presentation.encode(message).finish();

    // Write file
    fs.writeFile(path.resolve(pathToFile), buffer, function(error) {
      if (error) throw error;
      //ipcRenderer.send('log', path.basename(pathToFile) + ' saved');
      console.log(path.basename(pathToFile), 'saved');
      resolve();
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

exports.fillNotes = fillNotes;
exports.mergeLanguages = mergeLanguages;
exports.switchLanguages = switchLanguages;
