// vscode
import * as vscode from "vscode";
import { env } from "process";
import * as path from "path";
import * as fs from "fs";
import { platform } from "os";
import { spawnSync } from "child_process";

const getConfig = () => vscode.workspace.getConfiguration("mimium");

export const getMimiumPath = (): string => {
  const config = getConfig();

  if (env["MIMIUM_PATH"]) {
    return env["MIMIUM_PATH"];
  } else if (config.has("sharedir")) {
    return <string>config.get("sharedir");
  } else if (vscode.workspace.workspaceFolders) {
    return vscode.workspace.workspaceFolders[0].name;
  } else {
    return "";
  }
};

export const getExecutableCommand = (mimiumPath: string): string => {
  const config = getConfig();
  if (config.has("executable_path")) {
    return path.join(mimiumPath, <string>config.get("executable_path"));
  }
  if (platform() === "win32") {
    return path.join(mimiumPath, ".\\mimium-cli.exe");
  } else {
    if (spawnSync("which", ["mimium-cli"]).status === 0) {
      return "mimium-cli";
    } else {
      return path.join(mimiumPath, "./mimium-cli");
    }
  }
};
const testMimiumExecutable = (executablePath: string): boolean => {
  return spawnSync(executablePath, ["--version"]).status === 0;
};
const makeTmpfile = (editor: vscode.TextEditor, mmmpath: string): string => {
  const p = path.join(mmmpath, "./_vscode_tmp.mmm");
  fs.writeFileSync(p, editor.document.getText());
  return p;
};
export const runMimium = (terminal: vscode.Terminal): void => {
  const mmmpath = getMimiumPath();
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) return;
  const filepath = editor.document.isUntitled
    ? makeTmpfile(editor, mmmpath)
    : path.basename(editor.document.fileName);
  if (terminal) {
    terminal.dispose();
  }
  const execCommand = getExecutableCommand(mmmpath);
  if (testMimiumExecutable(execCommand) === false) {
    vscode.window.showErrorMessage(
      `mimium: can\'t find mimium executable.\
          Set mimium.sharedir in the VSCode settings.`
    );
  }
  let shelloption: vscode.TerminalOptions = {
    name: "mimium",
    cwd: path.dirname(editor.document.fileName),
  };
  if (platform() === "win32") {
    shelloption.shellPath = vscode.workspace
      .getConfiguration("terminal.external")
      .get("windowsExec");
  }
  terminal = vscode.window.createTerminal(shelloption);
  terminal.show(true); // show, but don't steal focus
  terminal.sendText(`${execCommand} ${filepath}`);
};
