"use strict";

// vscode
import * as vscode from "vscode";

// node
import { arch, platform } from "os";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { DownloaderHelper, ErrorStats } from "node-downloader-helper";
import { getMimiumPath, getExecutableCommand } from "./mimium_env";
import { Version, parseVersion } from "./utils";

const getConfig = () => vscode.workspace.getConfiguration("mimium");

const MIMIUM_RELEASES_PAGE =
  "https://github.com/mimium-org/mimium-rs/releases";
const MIMIUM_EXPANDED_ASSETS_PAGE =
  "https://github.com/mimium-org/mimium-rs/releases/expanded_assets";

type ReleaseChannel = "stable" | "alpha";

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  assets: GitHubReleaseAsset[];
};

type ReleaseDownload = {
  release: GitHubRelease;
  asset: GitHubReleaseAsset;
};

const getReleaseChannel = (): ReleaseChannel => {
  return getConfig().get<ReleaseChannel>("releaseChannel", "stable");
};

const fetchText = async (
  url: string,
  headers: Record<string, string>,
): Promise<string> => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `mimium: failed to fetch release metadata (${response.status} ${response.statusText})`,
    );
  }
  return response.text();
};

const parseReleasesFromHtml = (html: string): GitHubRelease[] => {
  const releaseMap = new Map<string, GitHubRelease>();
  const tagPattern = /\/releases\/tag\/([^"?#]+)/g;
  let matched: RegExpExecArray | null;

  while ((matched = tagPattern.exec(html)) !== null) {
    const tagName = decodeURIComponent(matched[1]);
    if (!releaseMap.has(tagName)) {
      releaseMap.set(tagName, {
        tag_name: tagName,
        draft: false,
        prerelease: isPrereleaseTag(tagName),
        published_at: "",
        assets: [],
      });
    }
  }

  return Array.from(releaseMap.values());
};

const parseAssetsFromHtml = (html: string): GitHubReleaseAsset[] => {
  const assetPattern = /href="([^"]*\/releases\/download\/[^"?#]+\.zip)"/g;
  const assetMap = new Map<string, GitHubReleaseAsset>();
  let matched: RegExpExecArray | null;

  while ((matched = assetPattern.exec(html)) !== null) {
    const href = matched[1].replace(/&amp;/g, "&");
    const browserDownloadUrl = href.startsWith("http")
      ? href
      : `https://github.com${href}`;
    const name = browserDownloadUrl.split("/").pop();
    if (!name || name.endsWith(".zip.sha256")) {
      continue;
    }
    assetMap.set(name, {
      name,
      browser_download_url: browserDownloadUrl,
    });
  }

  return Array.from(assetMap.values());
};

const fetchReleases = async (): Promise<GitHubRelease[]> => {
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "mimium-language-vscode",
  };
  const releasesPage = await fetchText(MIMIUM_RELEASES_PAGE, headers);
  const releases = parseReleasesFromHtml(releasesPage);

  for (const release of releases) {
    const assetsPage = await fetchText(
      `${MIMIUM_EXPANDED_ASSETS_PAGE}/${encodeURIComponent(release.tag_name)}`,
      headers,
    );
    release.assets = parseAssetsFromHtml(assetsPage);
  }

  return releases;
};

const isPrereleaseTag = (tagName: string): boolean => {
  return /-(alpha|beta|rc)(?:[.-]|$)/i.test(tagName);
};

const getTargetTriples = (): string[] => {
  switch (platform()) {
    case "win32":
      return ["x86_64-pc-windows-msvc"];
    case "darwin":
      return arch() === "x64"
        ? ["x86_64-apple-darwin"]
        : ["aarch64-apple-darwin"];
    case "linux":
      return ["x86_64-unknown-linux-gnu"];
    default:
      vscode.window.showErrorMessage(
        `mimium: binary download currently only \
            available for macOS, Windows & Linux (Ubuntu)`,
      );
      return [];
  }
};

const findMatchingAsset = (
  assets: GitHubReleaseAsset[],
  targetTriples: string[],
): GitHubReleaseAsset | undefined => {
  return assets.find((asset) => {
    return (
      asset.name.endsWith(".zip") &&
      !asset.name.endsWith(".zip.sha256") &&
      targetTriples.some((triple) => asset.name.includes(triple))
    );
  });
};

const resolveLatestRelease = async (
  channel: ReleaseChannel,
): Promise<ReleaseDownload | null> => {
  const targetTriples = getTargetTriples();
  if (targetTriples.length === 0) {
    return null;
  }

  const releases = await fetchReleases();
  const matchingRelease = releases
    .filter((release) => {
      if (release.draft) {
        return false;
      }
      if (channel === "stable") {
        return !release.prerelease && !isPrereleaseTag(release.tag_name);
      }
      return true;
    })
    .map((release) => ({
      release,
      asset: findMatchingAsset(release.assets, targetTriples),
    }))
    .find(
      (
        candidate,
      ): candidate is { release: GitHubRelease; asset: GitHubReleaseAsset } => {
        return candidate.asset !== undefined;
      },
    );

  return matchingRelease ?? null;
};

const getLatestVersionOfMimium = async (): Promise<Version> => {
  const releaseDownload = await resolveLatestRelease(getReleaseChannel());
  if (releaseDownload === null) {
    throw new Error("mimium: no downloadable release found for this platform");
  }
  return parseVersion(releaseDownload.release.tag_name);
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

const moveExtractedEntries = (
  extractRoot: string,
  destinationDir: string,
): void => {
  const extractedEntries = fs.readdirSync(extractRoot);
  const sourceDir =
    extractedEntries.length === 1 &&
    fs.statSync(path.join(extractRoot, extractedEntries[0])).isDirectory()
      ? path.join(extractRoot, extractedEntries[0])
      : extractRoot;

  for (const entry of fs.readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entry);
    const destinationPath = path.join(destinationDir, entry);
    fs.rmSync(destinationPath, { recursive: true, force: true });
    fs.renameSync(sourcePath, destinationPath);
  }
};

export const checkIfNewerVersionAvailable = async () => {
  let latest: Version;
  try {
    latest = await getLatestVersionOfMimium();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(message);
    return;
  }
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
  let releaseDownload: ReleaseDownload | null;
  try {
    releaseDownload = await resolveLatestRelease(getReleaseChannel());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(message);
    return;
  }

  if (!releaseDownload) {
    vscode.window.showErrorMessage(
      "mimium: no downloadable release asset found for the current platform",
    );
    return;
  }

  const mimiumVersion: string = releaseDownload.release.tag_name;
  const releaseFile = releaseDownload.asset.name;
  const ghReleaseUri = releaseDownload.asset.browser_download_url;

  const defaultDownloadDir = vscode.Uri.file(getDefaultDownloadPath()).fsPath;
  if (!fs.existsSync(defaultDownloadDir)) {
    fs.mkdirSync(defaultDownloadDir, { recursive: true });
  }
  // now, actually download the thing
  const downloader = new DownloaderHelper(ghReleaseUri, defaultDownloadDir, {});
  downloader.on("end", () => {
    const extractDir = fs.mkdtempSync(
      path.join(defaultDownloadDir, ".extract-"),
    );
    const res = spawnSync("tar", ["-xf", releaseFile, "-C", extractDir], {
      cwd: defaultDownloadDir,
    });

    if (res.error) {
      vscode.window.showErrorMessage(res.error.message);
      fs.rmSync(extractDir, { recursive: true, force: true });
      return;
    }
    if (res.status !== 0) {
      vscode.window.showErrorMessage(
        res.stderr.toString() || "mimium: failed to extract downloaded archive",
      );
      fs.rmSync(extractDir, { recursive: true, force: true });
      return;
    }

    moveExtractedEntries(extractDir, defaultDownloadDir);
    fs.rmSync(extractDir, { recursive: true, force: true });
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
        token.onCancellationRequested(() => {
          void downloader.stop();
        });
      },
    );
  });

  const error_handler = (e: ErrorStats) => {
    vscode.window.showErrorMessage(e.message);
  };
  downloader.on("error", error_handler);

  downloader.start().catch(error_handler);
};
