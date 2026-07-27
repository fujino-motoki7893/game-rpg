import { describe, expect, it } from "vitest";
import {
  getEquipmentUpgradeCost,
  getEquipmentUpgradeLabel,
  getUpgradedEquipmentStats,
  MAX_EQUIPMENT_UPGRADE_LEVEL
} from "./equipment";

describe("getEquipmentUpgradeLabel", () => {
  it("is blank at level 0 and +N above that", () => {
    expect(getEquipmentUpgradeLabel(0)).toBe("");
    expect(getEquipmentUpgradeLabel(1)).toBe("+1");
    expect(getEquipmentUpgradeLabel(2)).toBe("+2");
  });
});

describe("getUpgradedEquipmentStats", () => {
  it("adds a flat +1 per level to every non-zero stat (small base stays meaningful)", () => {
    // clothCap: defenseBonus 1, speedBonus 1, nothing else.
    expect(getUpgradedEquipmentStats("clothCap", 0)).toEqual({
      attackBonus: 0,
      defenseBonus: 1,
      maxHpBonus: 0,
      maxMpBonus: 0,
      speedBonus: 1
    });
    expect(getUpgradedEquipmentStats("clothCap", 1)).toEqual({
      attackBonus: 0,
      defenseBonus: 2,
      maxHpBonus: 0,
      maxMpBonus: 0,
      speedBonus: 2
    });
    expect(getUpgradedEquipmentStats("clothCap", 2)).toEqual({
      attackBonus: 0,
      defenseBonus: 3,
      maxHpBonus: 0,
      maxMpBonus: 0,
      speedBonus: 3
    });
  });

  it("never adds to a stat the base item doesn't have", () => {
    // woodSword only has attackBonus — defense/hp/mp/speed must stay 0 at every level.
    for (let level = 0; level <= MAX_EQUIPMENT_UPGRADE_LEVEL; level += 1) {
      const stats = getUpgradedEquipmentStats("woodSword", level);
      expect(stats.defenseBonus).toBe(0);
      expect(stats.maxHpBonus).toBe(0);
      expect(stats.maxMpBonus).toBe(0);
      expect(stats.speedBonus).toBe(0);
      expect(stats.attackBonus).toBe(2 + level);
    }
  });

  it("scales large masterwork bonuses too", () => {
    expect(getUpgradedEquipmentStats("masterworkGreatsword", 2)).toEqual({
      attackBonus: 13,
      defenseBonus: 0,
      maxHpBonus: 0,
      maxMpBonus: 0,
      speedBonus: 5
    });
  });
});

describe("getEquipmentUpgradeCost", () => {
  it("scales with the item's base price and current level", () => {
    // woodSword buyPrice 30.
    expect(getEquipmentUpgradeCost("woodSword", 0)).toBe(15);
    expect(getEquipmentUpgradeCost("woodSword", 1)).toBe(30);
  });

  it("never goes below the minimum floor for cheap/priceless items", () => {
    // ironSword has no buyPrice (drop-only), sellPrice 48 -> base 96.
    expect(getEquipmentUpgradeCost("ironSword", 0)).toBeGreaterThanOrEqual(10);
  });

  it("costs more to upgrade higher-rarity (pricier) gear than starter gear", () => {
    const starterCost = getEquipmentUpgradeCost("woodSword", 0);
    const masterworkCost = getEquipmentUpgradeCost("masterworkGreatsword", 0);
    expect(masterworkCost).toBeGreaterThan(starterCost);
  });
});
