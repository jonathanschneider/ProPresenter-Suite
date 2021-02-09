# ProPresenter Suite

## Introduction

As a church in Germany we sing a lot of songs in English and want to display German translations as well. For our international community we want to display English translations for the German songs. Sometimes we want to switch the language. And on the stage display we'd rather only show the lyrics without the translations.

Accomplishing this in ProPresenter 6 can be quite cumbersome so this little suite offers the following functions to manipulate ProPresenter 6 files:
* Copy the top layer text field to the slide notes (to display the slide notes on the stage display)
* Merge two presentations into one (merge two languages)
* Switch the layers of two text fields in one presentation (switch languages)

![alt text](https://github.com/jonathanschneider/ProPresenter-Suite/blob/master/assets/images/ProPresenter-Suite.png "GUI")

## Installation

Executables for Windows and macOS are available in under [releases](https://github.com/jonathanschneider/ProPresenter-Suite/releases).

For Windows [UnRTF](https://www.gnu.org/software/unrtf/) must be installed manually.

## Usage

1. Start ProPresenter Suite.
1. In the section of the function you want to execute, browse the file you want to edit. ProPresenter Suite will show a notification once it finishes.
1. In ProPresenter force save by pressing Ctrl + S or Cmd + S.
1. Choose "Revert" in the dialog.

Unfortunately the GUI is only in German. Pull requests are welcome.

## Development

I have started to upgrade the app for ProPresenter 7. If you can't wait or want to contribute, check out the [dev-pro7](https://github.com/jonathanschneider/ProPresenter-Suite/tree/dev-pro7) branch.

### Getting Started

If you want to contribute, here are some hints to get you started:

This app is built on [Electron](https://www.electronjs.org) and thus requires [Node.js](https://nodejs.org).

Clone repository and install dependencies:

    git clone https://github.com/jonathanschneider/ProPresenter-Suite.git
    cd ProPresenter-Suite
    npm install --production=false

Start the app from the CLI:

    npm start

Package app and create installers:
* Windows:

      npm run package-win
      npm run create-installer-win

* Mac:

      npm run package-mac
      npm run create-installer-mac
