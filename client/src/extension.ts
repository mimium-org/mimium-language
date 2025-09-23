"use strict";

// vscode
import * as vscode from "vscode";
import {
  Disposable,
  Executable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

import { downloadBinary, checkIfNewerVersionAvailable } from "./installer";
import { getMimiumPath, runMimium } from "./mimium_env";
import * as path from "path";

//globally shared terminal instance for mimium
let _terminal: vscode.Terminal;
let client: LanguageClient;

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
  const traceOutputChannel = vscode.window.createOutputChannel(
    "Mimium Language Server trace"
  );

  const command =
    process.env.MIMIUM_SERVER_PATH ||
    path.join(getMimiumPath(), "mimium-language-server") ||
    "mimium-language-server";
  const run: Executable = {
    command,
    options: {
      env: {
        ...process.env,
        RUST_LOG: "debug",
      },
    },
  };
  const serverOptions: ServerOptions = {
    run,
    debug: run,
  };
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "mimium" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
    },

    traceOutputChannel,
  };
  // Create the language client and start the client.
  client = new LanguageClient(
    "mimium-language-server",
    "mimium language server",
    serverOptions,
    clientOptions
  );

  client.start();

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
