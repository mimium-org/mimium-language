interface Comparable<T> {
    isNewer(base: T): boolean;
  }

const comparePrereleaseIdentifiers = (
  left: string,
  right: string,
): number => {
  const leftIsNumber = /^\d+$/.test(left);
  const rightIsNumber = /^\d+$/.test(right);

  if (leftIsNumber && rightIsNumber) {
    return parseInt(left, 10) - parseInt(right, 10);
  }
  if (leftIsNumber) {
    return -1;
  }
  if (rightIsNumber) {
    return 1;
  }
  return left.localeCompare(right);
};

const comparePrerelease = (left?: string, right?: string): number => {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }

  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const sharedLength = Math.min(leftParts.length, rightParts.length);

  for (let index = 0; index < sharedLength; index++) {
    const compared = comparePrereleaseIdentifiers(
      leftParts[index],
      rightParts[index],
    );
    if (compared !== 0) {
      return compared;
    }
  }

  return leftParts.length - rightParts.length;
};

/** Comparable Version class. **/
export class Version implements Comparable<Version> {
    text: string;
    major: number;
    minor: number;
    patch: number;
    prerelease?: string;
    /**
     * Constructs version from raw text.
     * @param {string} vstring raw version text. should be like "v0.2.45".
     *
     */
    constructor(vstring: string) {
      this.text = vstring;
      const matchedv = vstring.match(/v?([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z.-]+))?/);
      if (matchedv === null) {
        console.error("invalid version format");
        this.major = 0;
        this.minor = 0;
        this.patch = 0;
        return this;
      }
      if (!(matchedv.length == 4 || matchedv.length == 5)) {
        console.error("invalid version format");
        this.major = 0;
        this.minor = 0;
        this.patch = 0;
        return this;
      }
      this.major = parseInt(matchedv[1]);
      this.minor = parseInt(matchedv[2]);
      this.patch = parseInt(matchedv[3]);
      if (matchedv[4]) {
        this.prerelease = matchedv[4];
      }
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
      if (this.patch != base.patch) {
        return this.patch > base.patch;
      }
      return comparePrerelease(this.prerelease, base.prerelease) > 0;
    }
  }
  
  
  
export const parseVersion = (vstring: string): Version => {
    return new Version(vstring);
  };
  