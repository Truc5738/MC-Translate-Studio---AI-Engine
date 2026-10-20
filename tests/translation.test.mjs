import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { translateLocal } from "../lib/local-translator.ts";
import { translateZip } from "../lib/pack.ts";

test("Local Rules translates human-facing JSON values and preserves identifiers", () => {
  const source = JSON.stringify({
    name: "Settings",
    description: "Welcome",
    identifier: "minecraft:example"
  });
  const output = JSON.parse(translateLocal(source, "Vietnamese", "manifest.json"));
  assert.equal(output.name, "cài đặt");
  assert.equal(output.description, "chào mừng");
  assert.equal(output.identifier, "minecraft:example");
});

test("translation recursively processes text inside nested MCPack archives", async () => {
  const inner = new JSZip();
  inner.file("texts/en_US.lang", "settings=Settings\nwelcome=Welcome\n");
  const innerBytes = await inner.generateAsync({ type: "nodebuffer" });

  const outer = new JSZip();
  outer.file("Behavior.mcpack", innerBytes);
  const outerBytes = await outer.generateAsync({ type: "nodebuffer" });

  const result = await translateZip(
    outerBytes,
    "Vietnamese",
    async (source) => source
      .replace("Settings", "Cài đặt")
      .replace("Welcome", "Chào mừng")
  );

  const translatedOuter = await JSZip.loadAsync(result.buffer);
  const translatedInnerBytes = await translatedOuter.file("Behavior.mcpack").async("nodebuffer");
  const translatedInner = await JSZip.loadAsync(translatedInnerBytes);
  const text = await translatedInner.file("texts/en_US.lang").async("string");

  assert.match(text, /settings=Cài đặt/);
  assert.match(text, /welcome=Chào mừng/);
  assert.equal(result.translated, 1);
});
