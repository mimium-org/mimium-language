'use strict';

// vscode
import * as vscode from 'vscode';

// node
import {env} from 'process';
import {platform} from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {spawnSync} from 'child_process';
import download from 'download';
import got from 'got';

const getConfig = () => vscode.workspace.getConfiguration('mimium-language');
let _terminal: vscode.Terminal;

/**
 * called when extension has been terminated.
 */
export function dispose() {
  _terminal.dispose();
}

interface Comparable<T> {
    isNewer(base: T): boolean
}


/** Comparable Version class. **/
class Version implements Comparable<Version> {
    text: string
    major: number
    minor: number
    patch: number
    /**
    * Constructs version from raw text.
    * @param {string} vstring raw version text. should be like "v0.2.45".
    *
    */
    constructor(vstring: string) {
      this.text = vstring;
      const vnumbers = vstring.split('.');
      if ( vnumbers.length != 3 ) {
        console.error('invalid version format');
        this.major = 0;
        this.minor = 0;
        this.patch = 0;
      }
      this.major = parseInt(vnumbers[0]);
      this.minor = parseInt(vnumbers[1]);
      const patch_v = vnumbers[2].split("-");
      if (patch_v.length > 1 ){
        console.warn('semvar alpha is ignored');
      }
      this.patch = parseInt(patch_v[0]);
    }
    /**
     * @param {Version} base target version to compare.
     * @return {boolean} true if the version is newer than other
     * */
    isNewer(base: Version): boolean {
      if (this.major != base.major) {
        return this.major > base.major;
      }
      if (this.minor != base.minor) {
        return this.minor > base.minor;
      }
      return this.patch > base.patch;
    }
}

/**
 * main entry point from vscode.
 * @param {string} context - //vscode context
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
      vscode.commands.registerCommand('extension.mimiumdownloadbinary',
          downloadBinary));
  context.subscriptions.push(
      vscode.commands.registerCommand('extension.mimiumrun', runMimium));
  checkIfNewerVersionAvailable();
}

export const parseVersion = (vstring: string): Version => {
  return new Version(vstring);
};

const getLatestVersionOfMimium = async (): Promise<Version> => {
  const tagData: any = await got(
      'https://api.github.com/repos/tomoyanonymous/mimium-rs/releases/latest',
      {responseType: 'json', resolveBodyOnly: true},
  );
  const mimiumVersion: string = tagData['tag_name'];
  return parseVersion(mimiumVersion);
};

const getCurrentVersionOfMimium = (): Version|null => {
  const cp = spawnSync(getExecutableCommand(getMimiumPath()), ['--version']);
  if (cp.status!=0) {
    return null;
  }
  //mimium-cli returns "mimium-cli v2.0.0-alpha1" as a result
  const cp_v = cp.stdout.toString().split(" ")[1];
  return parseVersion(`${cp_v}`);
};
const checkIfNewerVersionAvailable = async () => {
  const latest = await getLatestVersionOfMimium();
  const current = getCurrentVersionOfMimium();
  const shouldGet:boolean = (current===null) ? true : latest.isNewer(current);
  if (shouldGet) {
    const currentvtext = (current===null) ? '' :`${current.text} => `;
    vscode.window.showInformationMessage(
        `Newer version of mimium is available.\
        (${currentvtext}${latest.text})`,
        {modal: false},
        {title: 'Download'},
        {title: 'Not now', isCloseAffordance: true},
        {title: 'Never ask again'}).then((selection)=> {
      if (selection===undefined) return;
      if (selection.title==='Download') {
        vscode.commands.executeCommand('extension.mimiumdownloadbinary');
      }
      if (selection.title==='Never Ask Again') {
        getConfig().update('checkupdate', false);
      }
    });
  }
};

const getMimiumPath = (): string => {
  const config = getConfig();
  if (env['MIMIUM_PATH']) {
    return env['MIMIUM_PATH'];
  } else if (config.has('sharedir')) {
    return <string>config.get('sharedir');
  } else if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].name;
  } else {
    return '';
  }
};

const testMimiumExecutable = (executablePath: string): boolean => {
  return spawnSync(executablePath, ['--version']).status === 0;
};

const getExecutableCommand = (mimiumPath: string): string => {
  const config = getConfig();
  if (config.has('executable_path')) {
    return path.join(mimiumPath, <string>config.get('executable_path'));
  }
  if (platform() === 'win32') {
    return path.join(mimiumPath, '.\\bin\\mimium.exe');
  } else {
    if (spawnSync('which', ['mimium']).status === 0) {
      return 'mimium';
    } else {
      return path.join(mimiumPath, './bin/mimium');
    }
  }
};
const runMimium = (): void => {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) return;
  const filepath = path.basename(editor.document.fileName);

  if (_terminal) {
    _terminal.dispose();
  }
  const execCommand = getExecutableCommand(getMimiumPath());
  if (testMimiumExecutable(execCommand) === false) {
    vscode.window.showErrorMessage(
        `mimium: can\'t find mimium executable.\
        Set extempore.sharedir in the VSCode settings.`);
  }
  const shelloption:vscode.TerminalOptions = {
    name: 'mimium',
    cwd: path.dirname(editor.document.fileName),
  };
  _terminal = vscode.window.createTerminal(shelloption);
  _terminal.show(true); // show, but don't steal focus
  _terminal.sendText(`${execCommand} ${filepath}`);
};
const getDefaultDownloadPath = ():string => {
  switch (platform()) {
    case 'win32':
      return `%USERPROFILE%`;
    case 'darwin':
    case 'linux':
      return `~/`;
    default:
      console.error('unsupported platform');
      return '~/';
  }
};
const getDownloadfileName = ():string => {
  switch (platform()) {
    case 'win32':
      return `mimium-cli-x86_64-pc-windows-msvc.zip`;
    case 'darwin':
      return `mimium-cli-aarch64-apple-darwin.tar.xz`;
    case 'linux':
      return `mimium-cli-x86_64-unknown-linux-gnu.tar.xz`;
    default:
      vscode.window.showErrorMessage(
          `mimium: binary download currently only \
          available for macOS, Windows & Linux (Ubuntu)`);
      return '~/';
  }
};

const downloadBinary = async () => {
  const mimiumVersionRaw = await getLatestVersionOfMimium();
  const mimiumVersion: string = mimiumVersionRaw.text;

  if (!mimiumVersion) {
    vscode.window.showErrorMessage(
        'mimium: error fetching latest release tag name');
    return;
  }

  const releaseFile = getDownloadfileName();
  const ghReleaseUri: string = `https://github.com/tomoyanonymous/mimium-rs/releases/download/${mimiumVersion}/${releaseFile}`;

  const defaultDownloadDir = vscode.Uri.file(getDefaultDownloadPath());
  // where should we put it?
  const downloadDir: string = await vscode.window.showOpenDialog(
      {
        defaultUri: defaultDownloadDir,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Choose Download Location',
      }).then((fileUris) =>
            (fileUris === undefined) ? '' : fileUris[0].fsPath,
  );

  const sharedir: string = path.join(downloadDir, releaseFile);
  if (fs.existsSync(sharedir)) {
    vscode.window.showErrorMessage(`mimium: sorry,\
    ${sharedir} already exists.`);
    return;
  }

  // now, actually download the thing
  const downloadOptions = {extract: true, timeout: 10 * 1000};
  download(ghReleaseUri, path.dirname(sharedir), downloadOptions)
      .on('downloadProgress', (progress) => {
        vscode.window.setStatusBarMessage(
            `mimium: download ${mimiumVersion} \
            ${(progress.percent * 100).toFixed(1)}% complete`);
      })
      .then(
          // success
          (value) => {
            const config = vscode.workspace.getConfiguration('mimium');
            config.update('sharedir', sharedir, true);
            vscode.window.showInformationMessage(
                `mimium: successfully downloaded \
                ${mimiumVersion} to ${sharedir}.\n\
                also updating mimium.sharedir config setting`);
          },
          // failure
          (reason) => {
            vscode.window.showErrorMessage(
                `mimium: error downloading binary "${reason}"`);
            return;
          },
      );
};
