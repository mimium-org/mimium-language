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
let terminal: vscode.Terminal|undefined;
let client: LanguageClient;
let traceOutputChannel: vscode.OutputChannel;

function getServerOption() {
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
  return serverOptions;
}
function getClientOption() {
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "mimium" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
    },

    traceOutputChannel,
  };
  return clientOptions;
}
function startLanguageClient(
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions
) {
  // Create the language client and start the client.
  client = new LanguageClient(
    "mimium-language-server",
    "mimium language server",
    serverOptions,
    clientOptions
  );

  client.start();
}
export function restartLanguageClient() {
  if (client.isRunning()) {
    client.stop();
  }
  startLanguageClient(getServerOption(), getClientOption());
}

/**
 * called when extension has been terminated.
 */
export function dispose() {
  if (terminal){
    terminal.dispose();
  }
}
/**
 * main entry point from vscode.
 * @param {string} context - //vscode context
 */
export function activate(context: vscode.ExtensionContext): void {
  traceOutputChannel = vscode.window.createOutputChannel(
    "Mimium Language Server trace"
  );
  startLanguageClient(getServerOption(), getClientOption());

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.mimium.restartServer",
      restartLanguageClient
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.mimiumrun", () => {
      runMimium(terminal);
    })
  );
  checkIfNewerVersionAvailable();
}
