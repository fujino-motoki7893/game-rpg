import { describe, expect, it } from "vitest";
import { BLOCKING_TILES } from "./maps";
import {
  generateDungeon,
  getDungeonDimensions,
  getDungeonEnemyKeysForTier,
  getDungeonGuardianKeyForTier,
  getDungeonNameForTier,
  getDungeonTileThemeForTier,
  getFieldDungeonEntranceForTier,
  getGuardianIdForTier,
  getRelicChestIdForTier,
  getSupplyChestCount,
  getSupplyChestEquipmentPool,
  hasFinalRelicForTier
} from "./dungeonGenerator";
import type { MapDefinition, TilePosition } from "../game/types";

const TIERS = [1, 2, 3, 4];

function isReachableFromSpawn(map: MapDefinition): { ok: boolean; unreachable: TilePosition[] } {
  const rows = map.rows;
  const walkable = (position: TilePosition): boolean => {
    const row = rows[position.y];
    if (!row || position.x < 0 || position.x >= row.length) {
      return false;
    }
    return !BLOCKING_TILES.has(row[position.x]);
  };

  const key = (p: TilePosition) => `${p.x},${p.y}`;
  const seen = new Set<string>([key(map.spawn)]);
  const queue: TilePosition[] = [map.spawn];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of [
      { x: current.x, y: current.y - 1 },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y }
    ]) {
      if (!walkable(next) || seen.has(key(next))) {
        continue;
      }
      seen.add(key(next));
      queue.push(next);
    }
  }

  const required: TilePosition[] = [
    ...map.enemies.map((e) => ({ x: e.x, y: e.y })),
    ...map.chests.map((c) => ({ x: c.x, y: c.y })),
    ...map.portals.map((p) => ({ x: p.x, y: p.y }))
  ];
  const unreachable = required.filter((p) => !seen.has(key(p)));
  return { ok: unreachable.length === 0, unreachable };
}

describe("getDungeonDimensions", () => {
  it("stays at the base size through the deep-floor threshold", () => {
    expect(getDungeonDimensions(1)).toEqual({ width: 40, height: 30 });
    expect(getDungeonDimensions(5)).toEqual({ width: 40, height: 30 });
  });

  it("grows past the deep-floor threshold", () => {
    expect(getDungeonDimensions(6)).toEqual({ width: 44, height: 33 });
    expect(getDungeonDimensions(8)).toEqual({ width: 52, height: 39 });
  });
});

describe("getSupplyChestCount", () => {
  it("stays within [1, 6] across the full roll range and deep floors", () => {
    for (const floor of [1, 5, 6, 8, 12]) {
      for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
        const count = getSupplyChestCount(floor, roll);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(6);
      }
    }
  });

  it("never decreases with depth for the same roll", () => {
    const roll = 0.5;
    let previous = getSupplyChestCount(1, roll);
    for (const floor of [3, 5, 6, 7, 8, 10, 12]) {
      const count = getSupplyChestCount(floor, roll);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });
});

describe("tier normalization", () => {
  it("clamps below-range tiers to tier 1", () => {
    expect(getDungeonGuardianKeyForTier(0)).toBe(getDungeonGuardianKeyForTier(1));
    expect(getGuardianIdForTier(-1)).toBe(getGuardianIdForTier(1));
    expect(getFieldDungeonEntranceForTier(0)).toEqual(getFieldDungeonEntranceForTier(1));
    expect(getDungeonTileThemeForTier(0)).toEqual(getDungeonTileThemeForTier(1));
    expect(getDungeonNameForTier(0)).toBe(getDungeonNameForTier(1));
  });

  it("clamps above-range tiers to tier 4", () => {
    expect(getDungeonGuardianKeyForTier(5)).toBe(getDungeonGuardianKeyForTier(4));
    expect(getDungeonGuardianKeyForTier(99)).toBe(getDungeonGuardianKeyForTier(4));
    expect(getGuardianIdForTier(99)).toBe(getGuardianIdForTier(4));
  });

  it("gives every tier a distinct guardian id and enemy key", () => {
    const ids = TIERS.map((tier) => getGuardianIdForTier(tier));
    const keys = TIERS.map((tier) => getDungeonGuardianKeyForTier(tier));
    expect(new Set(ids).size).toBe(TIERS.length);
    expect(new Set(keys).size).toBe(TIERS.length);
  });

  it("only grants the final relic on tiers 1-2", () => {
    expect(hasFinalRelicForTier(1)).toBe(true);
    expect(hasFinalRelicForTier(2)).toBe(true);
    expect(hasFinalRelicForTier(3)).toBe(false);
    expect(hasFinalRelicForTier(4)).toBe(false);
  });

  it("returns a non-empty enemy pool and equipment pool for every tier", () => {
    for (const tier of TIERS) {
      expect(getDungeonEnemyKeysForTier(tier).length).toBeGreaterThan(0);
      for (const bucket of ["early", "mid", "late"] as const) {
        expect(getSupplyChestEquipmentPool(bucket, tier).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("generateDungeon", () => {
  it("produces a grid matching getDungeonDimensions for the requested floor", () => {
    for (const floor of [1, 4, 6, 8]) {
      const { width, height } = getDungeonDimensions(floor);
      const map = generateDungeon({ seed: 1, floor, floorCount: 8, tier: 1 });
      expect(map.rows.length).toBe(height);
      for (const row of map.rows) {
        expect(row.length).toBe(width);
      }
    }
  });

  it("is deterministic for a given seed/floor/tier", () => {
    const options = { seed: 12345, floor: 3, floorCount: 8, tier: 2 };
    const a = generateDungeon(options);
    const b = generateDungeon(options);
    expect(a.rows).toEqual(b.rows);
    expect(a.enemies).toEqual(b.enemies);
    expect(a.chests).toEqual(b.chests);
    expect(a.portals).toEqual(b.portals);
  });

  it("keeps every enemy/chest/portal reachable from spawn, across tiers/floors/seeds", () => {
    const failures: string[] = [];
    for (const tier of TIERS) {
      for (const floor of [1, 3, 8]) {
        for (let seed = 0; seed < 5; seed += 1) {
          const map = generateDungeon({ seed: seed * 7919 + floor * 31 + tier, floor, floorCount: 8, tier });
          const { ok, unreachable } = isReachableFromSpawn(map);
          if (!ok) {
            failures.push(`tier=${tier} floor=${floor} seed=${seed}: ${JSON.stringify(unreachable)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("places a relic chest and the tier guardian only on the true final floor for low tiers", () => {
    const map = generateDungeon({ seed: 7, floor: 8, floorCount: 8, tier: 1 });
    const relicChest = map.chests.find((c) => c.reward?.type === "relic");
    expect(relicChest).toBeDefined();
    expect(relicChest?.id).toBe(getRelicChestIdForTier(1));

    const guardian = map.enemies.find((e) => e.id === getGuardianIdForTier(1));
    expect(guardian).toBeDefined();
    expect(guardian?.enemyKey).toBe(getDungeonGuardianKeyForTier(1));
  });

  it("places the tier guardian but no relic chest on the final floor for tiers without a final relic", () => {
    const map = generateDungeon({ seed: 7, floor: 8, floorCount: 8, tier: 3 });
    expect(map.chests.some((c) => c.reward?.type === "relic")).toBe(false);

    const guardian = map.enemies.find((e) => e.id === getGuardianIdForTier(3));
    expect(guardian).toBeDefined();
    expect(guardian?.enemyKey).toBe(getDungeonGuardianKeyForTier(3));
  });

  it("adds a stairs-down portal (not the guardian) on non-final floors", () => {
    const map = generateDungeon({ seed: 3, floor: 2, floorCount: 8, tier: 1 });
    expect(map.enemies.some((e) => e.id === getGuardianIdForTier(1))).toBe(false);

    const down = map.portals.find((p) => p.kind === "stairs-down");
    expect(down).toBeDefined();
    expect(down?.toFloor).toBe(3);
    expect(down?.dungeonTier).toBe(1);
  });

  it("routes the floor-1 up-stairs to the field at the tier's dungeon entrance", () => {
    for (const tier of TIERS) {
      const map = generateDungeon({ seed: 5, floor: 1, floorCount: 8, tier });
      const up = map.portals.find((p) => p.kind === "stairs-up");
      expect(up?.toMap).toBe("field");
      expect({ x: up?.toX, y: up?.toY }).toEqual(getFieldDungeonEntranceForTier(tier));
    }
  });

  it("keeps supply chest counts within bounds and gives every chest a reward", () => {
    const map = generateDungeon({ seed: 42, floor: 4, floorCount: 8, tier: 2 });
    const supplyChests = map.chests.filter((c) => c.reward?.type !== "relic");
    expect(supplyChests.length).toBeGreaterThanOrEqual(1);
    expect(supplyChests.length).toBeLessThanOrEqual(6);
    for (const chest of supplyChests) {
      expect(chest.reward).toBeDefined();
    }
  });

  it("can drop both single-status cure items and the all-cure panacea from chests", () => {
    const CURE_ITEM_IDS = ["burnCure", "poisonCure", "stunCure", "panacea"];
    const foundItemIds = new Set<string>();
    for (const tier of TIERS) {
      for (let seed = 0; seed < 40; seed += 1) {
        const map = generateDungeon({ seed: seed * 101 + tier, floor: 3, floorCount: 8, tier });
        map.chests.forEach((chest) => {
          if (chest.reward?.type === "item" && CURE_ITEM_IDS.includes(chest.reward.itemId)) {
            foundItemIds.add(chest.reward.itemId);
          }
        });
      }
    }
    // Every cure item — including the shop-unavailable panacea — should
    // show up somewhere across a large enough sample of chests.
    for (const itemId of CURE_ITEM_IDS) {
      expect(foundItemIds.has(itemId)).toBe(true);
    }
  });
});
