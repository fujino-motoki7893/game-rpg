import { describe, expect, it, beforeEach } from "vitest";
import {
  addItem,
  exportSaveCode,
  getSave,
  importSaveCode,
  markFlag,
  recruitCompanion,
  resetSave
} from "./GameState";

describe("exportSaveCode / importSaveCode", () => {
  beforeEach(() => {
    resetSave();
  });

  it("round-trips the current save through a code", () => {
    addItem("herb", 3);
    markFlag("questComplete");
    recruitCompanion("luna");

    const code = exportSaveCode();
    resetSave();
    expect(getSave().items.herb ?? 0).not.toBe(5);

    const result = importSaveCode(code);
    expect(result).toEqual({ imported: true });
    expect(getSave().items.herb).toBe(5);
    expect(getSave().flags.questComplete).toBe(true);
    expect(getSave().companions?.luna).toBeDefined();
  });

  it("rejects a code with the wrong prefix", () => {
    const result = importSaveCode("not-a-save-code");
    expect(result).toEqual({ imported: false, reason: "invalid-code" });
  });

  it("rejects a code that decodes to something other than an object", () => {
    const bogus = "TTRPG1:" + btoa("123");
    const result = importSaveCode(bogus);
    expect(result).toEqual({ imported: false, reason: "invalid-code" });
  });

  it("rejects garbled base64 after a valid-looking prefix without throwing", () => {
    const result = importSaveCode("TTRPG1:not-valid-base64!!!");
    expect(result).toEqual({ imported: false, reason: "invalid-code" });
  });

  it("leaves the current save untouched when import fails", () => {
    addItem("herb", 5);
    const before = getSave().items.herb;

    importSaveCode("garbage");

    expect(getSave().items.herb).toBe(before);
  });
});
