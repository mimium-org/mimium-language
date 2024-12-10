interface Comparable<T> {
    isNewer(base: T): boolean;
  }

/** Comparable Version class. **/
export class Version implements Comparable<Version> {
    text: string;
    major: number;
    minor: number;
    patch: number;
    /**
     * Constructs version from raw text.
     * @param {string} vstring raw version text. should be like "v0.2.45".
     *
     */
    constructor(vstring: string) {
      this.text = vstring;
      const matchedv = vstring.match(/v?([0-9]+)\.([0-9]+)\.([0-9]+)(-.*)?/);
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
        console.warn("alpha version is ignored.");
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
      return this.patch > base.patch;
    }
  }
  
  
  
export const parseVersion = (vstring: string): Version => {
    return new Version(vstring);
  };
  