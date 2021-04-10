const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller;
const path = require('path');

getInstallerConfig()
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });

function getInstallerConfig () {
  console.log('creating windows installer');
  const rootPath = path.join('./');
  const outPath = path.join(rootPath, 'release-builds');

  return Promise.resolve({
    appDirectory: path.join(outPath, 'ProPresenter-Suite-win32-ia32/'),
    authors: 'Jonathan Schneider',
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    exe: 'ProPresenter-Suite.exe',
    setupExe: 'ProPresenter-Suite-Installer-Windows.exe',
    setupIcon: path.join(rootPath, 'assets', 'icons', 'icon.ico')
  });
}
