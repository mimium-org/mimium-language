"use strict";

// vscode
import * as vscode from "vscode";

// node
import { env } from "process";
import { platform } from "os";
import * as fs from "fs";
import * as path from "path";
import { spawnSync, spawn } from "child_process";
import download from "download";
import got from "got";
import { getMimiumPath, getExecutableCommand } from "./mimium_env";
import { Version, parseVersion } from "./utils";

const getConfig = () => vscode.workspace.getConfiguration("mimium");

const getLatestVersionOfMimium = async (): Promise<Version> => {
  const endpoint = `https://api.github.com/repos/tomoyanonymous/mimium-rs/releases`;
  // const endpoint = `https://api.github.com/repos/tomoyanonymous/mimium-rs/releases?client_id=${client_id}?client_secret=${client_secret}`;

  const tagData: [any] = await got(endpoint, {
    responseType: "json",
    resolveBodyOnly: true,
  });
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
  const downloadOptions = { extract: false, timeout: 10 * 1000 };
  download(ghReleaseUri, defaultDownloadDir, downloadOptions)
    .on("downloadProgress", (progress) => {
      vscode.window.setStatusBarMessage(
        `mimium: download ${mimiumVersion} from ${ghReleaseUri} \
              ${(progress.percent * 100).toFixed(1)}% complete`
      );
    })
    .then(
      // success
      (value) => {
        const res = spawnSync("tar", ["-xf", releaseFile], {
          cwd: defaultDownloadDir,
        });

        if (res.error) {
          vscode.window.showErrorMessage(res.error.message);
        }
        fs.rmSync(releaseFile, { force: true });
        fs.chmodSync(
          path.join(defaultDownloadDir, getExecutableCommand(".")),
          0o755
        );
        // fs.rmSync(localarchive);
        const sharedir: string = defaultDownloadDir;
        const config = vscode.workspace.getConfiguration("mimium");
        config.update("sharedir", sharedir, true);
        vscode.window.showInformationMessage(
          `mimium: successfully downloaded \
                  ${mimiumVersion} to ${sharedir}.\n\
                  also updating mimium.sharedir config setting`
        );
      },
      // failure
      (reason) => {
        vscode.window.showErrorMessage(
          `mimium: error downloading binary "${reason}"`
        );
        return;
      }
    )
    .catch((reason) => {
      vscode.window.showErrorMessage(
        `mimium: error installing binary "${reason}"`
      );
      return;
    });
};
