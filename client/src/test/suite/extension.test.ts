import { parseVersion } from "../../utils";
import * as assert from "assert";

suite("parse version string", () => {
  test("test", () => {
    const v = parseVersion("mimium-cli v2.0.1-alpha");
    assert.equal(2, v.major);
    assert.equal(0, v.minor);
    assert.equal(1, v.patch);
    assert.equal("alpha", v.prerelease);
  });

  test("stable is newer than prerelease with same core version", () => {
    const stable = parseVersion("v4.0.0");
    const alpha = parseVersion("v4.0.0-alpha.7");
    assert.equal(true, stable.isNewer(alpha));
    assert.equal(false, alpha.isNewer(stable));
  });

  test("later prerelease identifier is newer", () => {
    const older = parseVersion("v4.0.0-alpha.6");
    const newer = parseVersion("v4.0.0-alpha.7");
    assert.equal(true, newer.isNewer(older));
  });
});
