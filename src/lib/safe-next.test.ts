import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath } from "./safe-next.ts";

test("only same-site paths survive", () => {
  assert.equal(safeNextPath("/learn/x?y=1"), "/learn/x?y=1");
  for (const bad of ["//evil.com", "/\t/evil.com", "/\n/evil.com", "/\\evil.com", "https://evil.com", null]) {
    assert.equal(safeNextPath(bad), "/learn", JSON.stringify(bad));
  }
});
