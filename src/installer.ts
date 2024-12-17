"use strict";

// vscode
import * as vscode from "vscode";

// node
import { platform } from "os";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { DownloaderHelper, ErrorStats } from "node-downloader-helper";
import { getMimiumPath, getExecutableCommand } from "./mimium_env";
import { Version, parseVersion } from "./utils";

const getConfig = () => vscode.workspace.getConfiguration("mimium");

const getLatestVersionOfMimium = async (): Promise<Version> => {
  const endpoint = `https://api.github.com/repos/tomoyanonymous/mimium-rs/releases`;
  // const endpoint = `https://api.github.com/repos/tomoyanonymous/mimium-rs/releases?client_id=${client_id}?client_secret=${client_secret}`;
  const tagData: [any] = await fetch(endpoint).then((res) => res.json());
  const sorted_responses = tagData.sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
  const mimiumVersion: string = sorted_responses[0].tag_name;
  return parseVersion(mimiumVersion);
};

const getCurrentVersionOfMimium = (): Version | null => {
  const cp = spawnSync(getExecutableCommand(getMimiumPath()), ["--version"]);
  if (cp.status != 0) {
    return null;
  }
  //mimium-cli returns "mimium-cli v2.0.0-alpha1" as a result
  const cp_v = cp.stdout.toString().split(" ")[1];
  return parseVersion(`${cp_v}`);
};

const getDefaultDownloadPath = (): string => {
  const homepath =
    process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
  if (homepath != undefined) {
    return path.join(homepath, ".mimium");
  } else {
    return "";
  }
};
const getDownloadfileName = (): string => {
  switch (platform()) {
    case "win32":
      return `mimium-cli-x86_64-pc-windows-msvc.zip`;
    case "darwin":
      return `mimium-cli-aarch64-apple-darwin.zip`;
    case "linux":
      return `mimium-cli-x86_64-unknown-linux-gnu.zip`;
    default:
      vscode.window.showErrorMessage(
        `mimium: binary download currently only \
            available for macOS, Windows & Linux (Ubuntu)`
      );
      return "~/";
  }
};

export const checkIfNewerVersionAvailable = async () => {
  const latest = await getLatestVersionOfMimium();
  const current = getCurrentVersionOfMimium();
  const shouldGet: boolean = current === null ? true : latest.isNewer(current);
  if (shouldGet) {
    const currentvtext = current === null ? "" : `${current.text} => `;
    vscode.window
      .showInformationMessage(
        `Newer version of mimium is available.\
            (${currentvtext}${latest.text})`,
        { modal: false },
        { title: "Download" },
        { title: "Not now", isCloseAffordance: true },
        { title: "Never ask again" }
      )
      .then((selection) => {
        if (selection === undefined) return;
        if (selection.title === "Download") {
          vscode.commands.executeCommand("extension.mimiumdownloadbinary");
        }
        if (selection.title === "Never Ask Again") {
          getConfig().update("checkupdate", false);
        }
      });
  }
};

export const downloadBinary = async () => {
  const mimiumVersionRaw = await getLatestVersionOfMimium();
  const mimiumVersion: string = mimiumVersionRaw.text;

  if (!mimiumVersion) {
    vscode.window.showErrorMessage(
      "mimium: error fetching latest release tag name"
    );
    return;
  }

  const releaseFile = getDownloadfileName();
  const ghReleaseUri: string = `https://github.com/tomoyanonymous/mimium-rs/releases/download/${mimiumVersion}/${releaseFile}`;

  const defaultDownloadDir = vscode.Uri.file(getDefaultDownloadPath()).fsPath;
  if (!fs.existsSync(defaultDownloadDir)) {
    fs.mkdirSync(defaultDownloadDir);
  }
  // now, actually download the thing
  const downloader = new DownloaderHelper(ghReleaseUri, defaultDownloadDir, {});
  downloader.on("end", (value) => {
    const res = spawnSync("tar", ["-xf", releaseFile], {
      cwd: defaultDownloadDir,
    });

    if (res.error) {
      vscode.window.showErrorMessage(res.error.message);
    }
    fs.rmSync(path.join(defaultDownloadDir, releaseFile), {
      force: true,
    });
    fs.chmodSync(
      path.join(defaultDownloadDir, getExecutableCommand(".")),
      0o755
    );
    const sharedir: string = defaultDownloadDir;
    const config = vscode.workspace.getConfiguration("mimium");
    config.update("sharedir", sharedir, true);
    vscode.window.showInformationMessage(
      `mimium: Successfully downloaded \
              ${mimiumVersion} to ${sharedir}.\n\
              also updating mimium.sharedir config setting`
    );
  });
  let progress_diff = {
    updated: false,
    val: 0.0,
  };
  downloader.on("progress", (stats) => {
    progress_diff.val = stats.progress - progress_diff.val;
    progress_diff.updated = true;
  });
  downloader.on("start", () => {
    vscode.window.withProgress(
      {
        title: "mimium",
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
      },
      async (progress, token) => {
        let incr = progress_diff.updated ? progress_diff.val : 0.0;
        progress.report({
          message: "Downloading the latest version of mimium...",
          increment: incr,
        });
        if (token.isCancellationRequested){
          await downloader.stop()
        }
      }
    );
  });

  const error_handler = (e: ErrorStats) => {
    vscode.window.showErrorMessage(e.message);
  };
  downloader.on("error", error_handler);

  downloader.start().catch(error_handler);
};
