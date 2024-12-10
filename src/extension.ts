"use strict";

// vscode
import * as vscode from "vscode";

import { downloadBinary, checkIfNewerVersionAvailable } from "./installer";
import { runMimium } from "./mimium_env";
//globally shared terminal instance for mimium
let _terminal: vscode.Terminal;

/**
 * called when extension has been terminated.
 */
export function dispose() {
  _terminal.dispose();
}
/**
 * main entry point from vscode.
 * @param {string} context - //vscode context
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.mimiumdownloadbinary",
      downloadBinary
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.mimiumrun", () => {
      runMimium(_terminal);
    })
  );
  checkIfNewerVersionAvailable();
}
