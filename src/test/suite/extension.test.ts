import { parseVersion } from "../../utils";
import * as assert from "assert";

suite("parse version string", () => {
  test("test", () => {
    const v = parseVersion("mimium-cli v2.0.1-alpha");
    assert.equal(2, v.major);
    assert.equal(0, v.minor);
    assert.equal(1, v.patch);
  });
});
