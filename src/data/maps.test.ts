import { describe, expect, it } from "vitest";
import { BLOCKING_TILES, EXPANDED_MAPS, MAPS } from "./maps";
import type { MapDefinition } from "../game/types";

function allMaps(): { label: string; map: MapDefinition }[] {
  const entries: { label: string; map: MapDefinition }[] = [];
  (Object.keys(MAPS) as (keyof typeof MAPS)[]).forEach((id) => {
    entries.push({ label: `MAPS.${id}`, map: MAPS[id] });
  });
  (Object.keys(EXPANDED_MAPS) as (keyof typeof EXPANDED_MAPS)[]).forEach((id) => {
    const map = EXPANDED_MAPS[id];
    if (map) {
      entries.push({ label: `EXPANDED_MAPS.${id}`, map });
    }
  });
  return entries;
}

function isWalkable(map: MapDefinition, x: number, y: number): boolean {
  const row = map.rows[y];
  if (!row || x < 0 || x >= row.length) {
    return false;
  }
  return !BLOCKING_TILES.has(row[x]);
}

describe("map grids", () => {
  it.each(allMaps())("$label: every row has the same length as the first", ({ map }) => {
    const width = map.rows[0].length;
    map.rows.forEach((row, y) => {
      expect(row.length, `row ${y}`).toBe(width);
    });
  });

  it.each(allMaps())("$label: spawn tile is walkable", ({ map }) => {
    expect(isWalkable(map, map.spawn.x, map.spawn.y)).toBe(true);
  });

  it.each(allMaps())("$label: every portal/npc/chest/enemy sits on a walkable tile", ({ map }) => {
    map.portals.forEach((p) => expect(isWalkable(map, p.x, p.y), `portal at ${p.x},${p.y}`).toBe(true));
    map.npcs.forEach((n) => expect(isWalkable(map, n.x, n.y), `npc ${n.id} at ${n.x},${n.y}`).toBe(true));
    map.chests.forEach((c) => expect(isWalkable(map, c.x, c.y), `chest ${c.id} at ${c.x},${c.y}`).toBe(true));
    map.enemies.forEach((e) => expect(isWalkable(map, e.x, e.y), `enemy ${e.id} at ${e.x},${e.y}`).toBe(true));
  });
});

describe("highlands map", () => {
  const map = EXPANDED_MAPS.highlands ?? MAPS.highlands;

  it("is at least as large as field/village, per the 'spacious, room to grow' ask", () => {
    expect(map.rows[0].length).toBeGreaterThanOrEqual(40);
    expect(map.rows.length).toBeGreaterThanOrEqual(30);
  });

  it("uses the snow ground theme", () => {
    expect(map.groundTheme).toBe("snow");
  });

  it("hosts the tier-4 dungeon entrance and the hiddenVillage portal", () => {
    expect(map.portals.some((p) => p.toMap === "dungeon" && p.dungeonTier === 4)).toBe(true);
    expect(map.portals.some((p) => p.toMap === "hiddenVillage")).toBe(true);
    expect(map.portals.some((p) => p.toMap === "field")).toBe(true);
  });
});

describe("field -> highlands relocation", () => {
  it("field no longer routes directly to hiddenVillage or a tier-4 dungeon", () => {
    const field = EXPANDED_MAPS.field!;
    expect(field.portals.some((p) => p.toMap === "hiddenVillage")).toBe(false);
    expect(field.portals.some((p) => p.toMap === "dungeon" && p.dungeonTier === 4)).toBe(false);
  });

  it("field has exactly one gated portal to highlands", () => {
    const field = EXPANDED_MAPS.field!;
    const toHighlands = field.portals.filter((p) => p.toMap === "highlands");
    expect(toHighlands).toHaveLength(1);
    expect(toHighlands[0].requiresFlag).toBe("finalBeastDefeated");
  });

  it("hiddenVillage's return portal now points at highlands, not field", () => {
    expect(MAPS.hiddenVillage.portals[0].toMap).toBe("highlands");
  });
});
