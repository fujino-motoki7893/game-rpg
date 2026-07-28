import { describe, expect, it, beforeEach } from "vitest";
import {
  addItem,
  exportSaveCode,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  getGeneratedDungeonFloor,
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

describe("migrateV1ToV2 (tier-4 dungeon relocation to highlands)", () => {
  beforeEach(() => {
    resetSave();
  });

  it("drops a cached tier-4 floor (stale field-return portal) but keeps descent progress", () => {
    const v1Save = {
      saveVersion: 1,
      mapId: "village",
      x: 20,
      y: 15,
      hp: 30,
      maxHp: 30,
      mp: 8,
      maxMp: 8,
      attack: 7,
      speed: 8,
      level: 1,
      exp: 0,
      gold: 0,
      potions: 2,
      items: {},
      equipmentInventory: {},
      equipment: {},
      equipmentUpgrades: {},
      flags: {},
      defeatedEnemies: [],
      dungeonProgressByTier: {
        4: {
          floorCount: 7,
          currentFloor: 3,
          generatedFloors: {
            1: {
              id: "dungeon",
              name: "霧隠れの深部",
              spawn: { x: 1, y: 1 },
              rows: ["####", "#.O#", "#..#", "####"],
              portals: [{ x: 1, y: 1, toMap: "field", toX: 8, toY: 19, kind: "stairs-up" }],
              npcs: [],
              chests: [],
              enemies: []
            }
          }
        }
      }
    };

    const bytes = new TextEncoder().encode(JSON.stringify(v1Save));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const code = "TTRPG1:" + btoa(binary);
    const result = importSaveCode(code);

    expect(result).toEqual({ imported: true });
    expect(getSave().saveVersion).toBe(2);
    expect(getGeneratedDungeonFloor(1, 4)).toBeUndefined();
    expect(getDungeonFloorCount(4)).toBe(7);
    expect(getCurrentDungeonFloor(4)).toBe(3);
  });

  it("is a no-op for saves with no cached tier-4 floors", () => {
    const code = exportSaveCode();
    const result = importSaveCode(code);
    expect(result).toEqual({ imported: true });
    expect(getSave().saveVersion).toBe(2);
  });
});
