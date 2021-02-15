const ipc = require('electron').ipcRenderer;
const fs = require('fs');
const path = require('path');
var protobuf = require('protobufjs');

const notesStyle = '{\\rtf1\\ansi\\ansicpg1252\\cocoartf2577\n\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n{\\colortbl;\\red255\\green255\\blue255;\\red0\\green0\\blue0;}\n{\\*\\expandedcolortbl;;\\cssrgb\\c0\\c0\\c0\\cname textColor;}\n\\pard\\tx560\\tx1120\\tx1680\\tx2240\\tx2800\\tx3360\\tx3920\\tx4480\\tx5040\\tx5600\\tx6160\\tx6720\\pardirnatural\\partightenfactor0\n\n\\f0\\fs24 \\cf2 ';
var Presentation;

// CLI
let fromCli;
if (process.argv[0].endsWith('node')) {
  fromCli = true;
  switch (process.argv[2]) {
    case '-n':
      fillNotes(process.argv[3]);
      break;
    case '-m':
      mergeLanguages([process.argv[3], process.argv[4]]);
      break;
    case '-s':
      switchLanguages(process.argv[3]);
      break;
    default:
      console.log('No valid option');
  }
}

async function fillNotes(pathToFile) {
  var presentation = await readFile(pathToFile);

  if (presentation.cues === undefined) { // Check if presentation contains any slides
    throw "Presentation doesn't contain any slides";
  }

  presentation = await fillNotesSub(presentation);

  // Write file
  await writeFile(pathToFile, presentation);
  return 'File saved as "' + path.basename(pathToFile) + '"';
}

async function fillNotesSub(presentation) {
  for (const cue of presentation.cues) { // forEach doesn't consider await, use for instead
    for (const action of cue.actions) {
      // Filter slides with text
      if (action.type === 'ACTION_TYPE_PRESENTATION_SLIDE' && action.slide.presentation.baseSlide.elements !== undefined) {

        // Get text from RTF
        let text = await getText(action.slide.presentation.baseSlide.elements[0].element.text.rtfData);

        // Reassemble RTF for notes
        let buffer = Buffer.from(notesStyle + text + '}'); // Encode base64
        action.slide.presentation.notes = {
          'rtfData': buffer.toString('base64')
        };
      }
    }
  }
  return presentation;
}

async function mergeLanguages(paths) {
  let presentations = await Promise.all(paths.map(readFile));

  if (presentations[0].cues === undefined || presentations[1].cues === undefined) { // Check if presentations contain any slides
    throw "At least one document doesn't have any slides";
  }

  for (let cue = 0; cue < Math.min(presentations[0].cues.length, presentations[1].cues.length); cue++) { // forEach doesn't consider await, use for instead
    // Get action in current cue of second presentation that's a slide
    let action = presentations[1].cues[cue].actions.find(action => action.type === 'ACTION_TYPE_PRESENTATION_SLIDE');

    if (action.slide.presentation.baseSlide.elements === undefined) break; // Skip to next cue if slide contains no elements
    action.slide.presentation.baseSlide.elements[0].element.name = 'Translation';

    // Find action in current cue of first presentation that's a slide
    let index = presentations[0].cues[cue].actions.findIndex(action => action.type === 'ACTION_TYPE_PRESENTATION_SLIDE');

    // Add first element of action to current cue of first presentation
    if (presentations[0].cues[cue].actions[index].slide.presentation.baseSlide.elements !== undefined) {
      presentations[0].cues[cue].actions[index].slide.presentation.baseSlide.elements.push(action.slide.presentation.baseSlide.elements[0]);
    } else {
      presentations[0].cues[cue].actions[index].slide.presentation.baseSlide.elements = action.slide.presentation.baseSlide.elements;
    }
  }

  // Write to new file
  let newFilePath = paths[0].replace('.pro', ' (merged).pro');
  await writeFile(newFilePath, presentations[0]);
  return 'File saved as "' + path.basename(newFilePath) + '"';
}

async function switchLanguages(pathToFile) {
  var presentation = await readFile(pathToFile);

  if (presentation.cues === undefined) { // Check if presentation contains any slides
    throw "Presentation doesn't contain any slides";
  }

  for (const cue of presentation.cues) { // forEach doesn't consider await, use for instead
    for (const action of cue.actions) {
      // Filter slides with text
      if (action.type === 'ACTION_TYPE_PRESENTATION_SLIDE' && action.slide.presentation.baseSlide.elements !== undefined) {

        // Get text from RTF
        let text1 = await getText(action.slide.presentation.baseSlide.elements[0].element.text.rtfData);
        let text2 = await getText(action.slide.presentation.baseSlide.elements[1].element.text.rtfData);

        // Replace text in first text element
        let buffer = Buffer.from(action.slide.presentation.baseSlide.elements[0].element.text.rtfData, 'base64');
        let decoded = buffer.toString();
        buffer = Buffer.from(decoded.replace(text1, text2)); // Encode base64
        action.slide.presentation.baseSlide.elements[0].element.text.rtfData = buffer.toString('base64');

        // Replace text in second text element
        buffer = Buffer.from(action.slide.presentation.baseSlide.elements[1].element.text.rtfData, 'base64');
        decoded = buffer.toString();
        buffer = Buffer.from(decoded.replace(text2, text1)); // Encode base64
        action.slide.presentation.baseSlide.elements[1].element.text.rtfData = buffer.toString('base64');
      }
    }
  }

  // Fill notes
  presentation = await fillNotesSub(presentation);

  // Write to new file
  let newFilePath = pathToFile.replace('.pro', ' (switched).pro');
  await writeFile(newFilePath, presentation);
  return 'File saved as "' + path.basename(newFilePath) + '"';
}

function readFile(pathToFile) {
  return new Promise(resolve => {
    log('Reading file ' + path.basename(pathToFile));
    let buffer = fs.readFileSync(pathToFile);

    protobuf.load(__dirname + '/proto/presentation.proto', function(error, root) {
      if (error) throw error;

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
    log('Writing to file ' + path.basename(pathToFile));

    // Convert to message
    let message = Presentation.fromObject(object);

    // Encode message to buffer
    let buffer = Presentation.encode(message).finish();

    // Write file
    fs.writeFile(path.resolve(pathToFile), buffer, function(error) {
      if (error) throw error;
      log('File saved as "' + path.basename(pathToFile) + '"');
      resolve();
    });
  });
}

function getText(data) {
  let buffer = Buffer.from(data, 'base64'); // Convert to buffer
  let decoded = buffer.toString(); // Decode Base64

  var basicRtfPattern = /\{\*?\\[^{}]+;}|[{}]|\\[A-Za-z]+\n?(?:-?\d+)?[ ]?/g;
  var ctrlCharPattern = /\n\\f[0-9]\s/g;

  // Remove RTF formatting and remove whitespace
  return decoded
    .replace(ctrlCharPattern, "")
    .replace(basicRtfPattern, "")
    .trim();
}

function log(message) {
  if (fromCli) { // Call from CLI
    console.log(message);
  } else { // Call from app
    ipc.send('log', message);
  }
}

exports.fillNotes = fillNotes;
exports.mergeLanguages = mergeLanguages;
exports.switchLanguages = switchLanguages;
