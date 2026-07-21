import {
  generateDungeon,
  getDungeonEnemyKeysForTier,
  getDungeonGuardianKeyForTier,
  hasFinalRelicForTier
} from "./dungeonGenerator";
import { ENEMIES } from "./enemies";
import { isEquipmentId } from "./equipment";
import { isItemId } from "./items";
import type { ChestDefinition, MapDefinition, TilePosition } from "../game/types";

export type DungeonSource = "groq" | "worker-local" | "local";

interface DungeonApiResponse {
  map?: unknown;
  source?: DungeonSource;
}

export async function createDungeon(
  floor: number,
  floorCount: number,
  upTarget?: TilePosition,
  tier = 1
): Promise<{ dungeon: MapDefinition; source: DungeonSource }> {
  try {
    const response = await fetch("/api/dungeon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "王道ファンタジー", size: "small", floor, floorCount, upTarget, tier }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error(`Dungeon API returned ${response.status}`);
    }

    const payload = (await response.json()) as DungeonApiResponse;
    if (!isDungeonMap(payload.map, floor, floorCount, tier)) {
      throw new Error("Dungeon API returned an invalid map");
    }

    return {
      dungeon: payload.map,
      source: payload.source === "groq" ? "groq" : "worker-local"
    };
  } catch {
    return { dungeon: generateDungeon({ floor, floorCount, upTarget, tier }), source: "local" };
  }
}

function isDungeonMap(value: unknown, floor: number, floorCount: number, tier: number): value is MapDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const map = value as MapDefinition;
  const baseValid =
    map.id === "dungeon" &&
    typeof map.name === "string" &&
    isTilePosition(map.spawn) &&
    map.floor === floor &&
    map.floorCount === floorCount &&
    Array.isArray(map.rows) &&
    map.rows.length === 30 &&
    map.rows.every((row) => typeof row === "string" && row.length === 40) &&
    Array.isArray(map.portals) &&
    Array.isArray(map.npcs) &&
    Array.isArray(map.chests) &&
    map.chests.every(isChestDefinition) &&
    Array.isArray(map.enemies) &&
    map.enemies.length >= 2 &&
    map.enemies.every(
      (enemy) =>
        typeof enemy.id === "string" &&
        typeof enemy.enemyKey === "string" &&
        Boolean(ENEMIES[enemy.enemyKey]) &&
        isTilePosition(enemy)
    ) &&
    map.portals.some((portal) => portal.kind === "stairs-up" && isTilePosition(portal));

  if (!baseValid) {
    return false;
  }

  const guardianKey = getDungeonGuardianKeyForTier(tier);
  const allowedEnemyKeys = new Set<string>(getDungeonEnemyKeysForTier(tier));
  const enemyKeysValid = map.enemies.every((enemy) =>
    enemy.id === "dungeon-guardian"
      ? enemy.enemyKey === guardianKey
      : allowedEnemyKeys.has(enemy.enemyKey)
  );

  if (!enemyKeysValid) {
    return false;
  }

  if (floor >= floorCount) {
    const hasFinalRelic = hasFinalRelicForTier(tier);
    return (
      map.chests.some(isItemRewardChest) &&
      (hasFinalRelic
        ? map.chests.some((chest) => chest.reward?.type === "relic" && isTilePosition(chest))
        : !map.chests.some((chest) => chest.reward?.type === "relic")) &&
      map.enemies.some(
        (enemy) =>
          enemy.id === "dungeon-guardian" &&
          enemy.enemyKey === guardianKey &&
          isTilePosition(enemy)
      )
    );
  }

  return (
    map.chests.some(isItemRewardChest) &&
    !map.chests.some((chest) => chest.id === "relic-chest" || chest.reward?.type === "relic") &&
    map.portals.some(
      (portal) =>
        portal.kind === "stairs-down" &&
        portal.toMap === "dungeon" &&
        portal.toFloor === floor + 1 &&
        isTilePosition(portal)
    ) &&
    map.enemies.some(
      (enemy) =>
        enemy.enemyKey !== "guardian" &&
        enemy.enemyKey !== "deepGuardian" &&
        isTilePosition(enemy)
    )
  );
}

function isChestDefinition(value: unknown): value is ChestDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const chest = value as ChestDefinition;
  if (typeof chest.id !== "string" || !isTilePosition(chest)) {
    return false;
  }

  if (!chest.reward) {
    return true;
  }

  if (chest.reward.type === "relic") {
    return true;
  }

  if (chest.reward.type === "item") {
    return (
      isItemId(chest.reward.itemId) &&
      Number.isInteger(chest.reward.quantity) &&
      chest.reward.quantity > 0
    );
  }

  return (
    chest.reward.type === "equipment" &&
    isEquipmentId(chest.reward.equipmentId) &&
    Number.isInteger(chest.reward.quantity) &&
    chest.reward.quantity > 0
  );
}

function isItemRewardChest(chest: ChestDefinition): boolean {
  return (
    ((chest.reward?.type === "item" && isItemId(chest.reward.itemId)) ||
      (chest.reward?.type === "equipment" && isEquipmentId(chest.reward.equipmentId))) &&
    Number.isInteger(chest.reward.quantity) &&
    chest.reward.quantity > 0
  );
}

function isTilePosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const position = value as { x?: unknown; y?: unknown };
  return Number.isInteger(position.x) && Number.isInteger(position.y);
}
