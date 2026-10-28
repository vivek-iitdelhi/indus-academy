import assert from "node:assert/strict";
import { test } from "node:test";
import { blocksEmbeddedRoom } from "./embedded-room.ts";

const UA = {
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

test("Safari and every iPhone/iPad browser get the room in its own tab; Chrome, Edge, Firefox, Android embed it", () => {
  assert.equal(blocksEmbeddedRoom(UA.macSafari), true);
  assert.equal(blocksEmbeddedRoom(UA.iphoneSafari), true);
  assert.equal(blocksEmbeddedRoom(UA.iphoneChrome), true); // WebKit underneath
  assert.equal(blocksEmbeddedRoom(UA.macSafari.replace("Version/18.1 ", ""), 5), true); // iPadOS as a Mac, with touch
  assert.equal(blocksEmbeddedRoom(UA.macChrome), false);
  assert.equal(blocksEmbeddedRoom(UA.winEdge), false);
  assert.equal(blocksEmbeddedRoom(UA.winFirefox), false);
  assert.equal(blocksEmbeddedRoom(UA.androidChrome), false);
  assert.equal(blocksEmbeddedRoom(UA.macChrome, 0), false);
});
