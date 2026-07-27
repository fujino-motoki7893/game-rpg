import { describe, expect, it } from "vitest";
import {
  dungeonTileFrame,
  overworldGroundGroup,
  overworldGroundUnderObjectFrame,
  overworldTileFrame,
  TERRAIN_DUNGEON_KEY,
  TERRAIN_OVERWORLD_KEY
} from "./autotile";

describe("overworldGroundGroup", () => {
  it("maps ground chars to their group", () => {
    expect(overworldGroundGroup(".")).toBe("grass");
    expect(overworldGroundGroup(",")).toBe("tallGrass");
    expect(overworldGroundGroup("S")).toBe("tallGrass");
    expect(overworldGroundGroup("G")).toBe("tallGrass");
    expect(overworldGroundGroup("=")).toBe("path");
    expect(overworldGroundGroup("O")).toBe("path");
    expect(overworldGroundGroup("~")).toBe("water");
    // dungeon-only markers reused on the overworld default to grass.
    expect(overworldGroundGroup("B")).toBe("grass");
    expect(overworldGroundGroup("U")).toBe("grass");
  });

  it("returns null for object tiles that keep their own dedicated texture", () => {
    expect(overworldGroundGroup("H")).toBeNull();
    expect(overworldGroundGroup("#")).toBeNull();
    expect(overworldGroundGroup("^")).toBeNull();
    expect(overworldGroundGroup("C")).toBeNull();
  });
});

describe("overworldTileFrame", () => {
  it("returns null for non-ground (object) tiles", () => {
    const rows = ["...", ".H.", "..."];
    expect(overworldTileFrame(rows, 1, 1)).toBeNull();
  });

  it("returns the solid frame for each group when fully surrounded by itself", () => {
    expect(overworldTileFrame(["...", "...", "..."], 1, 1)).toBe(0); // grass
    expect(overworldTileFrame([",,,", ",,,", ",,,"], 1, 1)).toBe(1); // tallGrass
    expect(overworldTileFrame(["===", "===", "==="], 1, 1)).toBe(2); // path
    expect(overworldTileFrame(["~~~", "~~~", "~~~"], 1, 1)).toBe(3); // water

    // Map edges/corners have no neighbors at all — every direction falls
    // back to "self", so a lone tile is still its own solid frame.
    expect(overworldTileFrame(["."], 0, 0)).toBe(0);
  });

  it("treats a non-ground neighbor (house/tree/rock) as self, not a blend partner", () => {
    // Grass tile at (1,1) with a house directly above it (tr) and otherwise
    // grass everywhere else — should stay the solid grass frame.
    const rows = [".H.", "...", "..."];
    expect(overworldTileFrame(rows, 1, 1)).toBe(0);
  });

  it("picks the correct corner-blend frame for a known grass/water corner", () => {
    // self=(1,1)=grass. tl=(0,0)=water, tr=(1,0)=grass, bl=(0,1)=grass.
    // grass/water is GROUND_PAIRS index 2 -> base (1+2)*16=48.
    // bitmask: tl(water)=1, tr(grass)=0, bl(grass)=0, self(grass)=0 -> 1.
    const rows = ["~..", "...", "..."];
    expect(overworldTileFrame(rows, 1, 1)).toBe(49);
  });

  it("picks the correct corner-blend frame for grass/tallGrass (first pair, index 0)", () => {
    // tl=tallGrass, tr/bl/self=grass -> base (1+0)*16=16, bitmask 1 -> 17.
    const rows = [",..", "...", "..."];
    expect(overworldTileFrame(rows, 1, 1)).toBe(17);
  });

  it("collapses a third, unrelated terrain at a corner to self", () => {
    // self=grass, tl=path, tr=water, bl=grass. Two different non-self
    // terrains tie at one occurrence each, so the first encountered (path,
    // via tl) wins as the blend partner; the water corner (not part of the
    // grass/path pair) then collapses to self per the "third terrain ->
    // self" rule. grass/path is GROUND_PAIRS index 1 -> base (1+1)*16=32,
    // bitmask: tl(path)=1, tr(collapsed to grass)=0, bl(grass)=0, self=0.
    const rows = ["=~.", "...", "..."];
    expect(overworldTileFrame(rows, 1, 1)).toBe(33);
  });
});

describe("overworldGroundUnderObjectFrame", () => {
  it("blends as grass regardless of the object tile's own char", () => {
    const rows = ["...", ".H.", "..."];
    expect(overworldGroundUnderObjectFrame(rows, 1, 1)).toBe(0);
  });

  it("blends toward an adjacent ground type even under an object tile", () => {
    const rows = ["~.H", "...", "..."];
    // Same corner layout as the grass/water test above, just queried at an
    // object cell (2,0) instead of a ground cell.
    expect(overworldGroundUnderObjectFrame(rows, 1, 1)).toBe(49);
  });
});

describe("dungeonTileFrame", () => {
  it("returns the solid wall/floor frame per tier when fully surrounded by itself", () => {
    const allWall = ["###", "###", "###"];
    const allFloor = ["...", "...", "..."];

    expect(dungeonTileFrame(allWall, 1, 1, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 0 });
    expect(dungeonTileFrame(allFloor, 1, 1, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 1 });

    // tier base = (tier-1)*32
    expect(dungeonTileFrame(allWall, 1, 1, 3)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 64 });
    expect(dungeonTileFrame(allFloor, 1, 1, 3)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 65 });
  });

  it("clamps out-of-range tiers into [1,4]", () => {
    const allWall = ["###", "###", "###"];
    expect(dungeonTileFrame(allWall, 1, 1, 0)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 0 });
    expect(dungeonTileFrame(allWall, 1, 1, -5)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 0 });
    expect(dungeonTileFrame(allWall, 1, 1, 4)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 96 });
    expect(dungeonTileFrame(allWall, 1, 1, 99)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 96 });
  });

  it("reuses the overworld sheet's solid water frame for water tiles", () => {
    const rows = ["~~~", "~~~", "~~~"];
    expect(dungeonTileFrame(rows, 1, 1, 2)).toEqual({ key: TERRAIN_OVERWORLD_KEY, frame: 3 });
  });

  it("treats a water neighbor as self so it never corrupts the wall/floor bitmask", () => {
    // self=(1,1)=wall, tl=water, tr=wall, bl=wall -> water neighbor should
    // fall back to "self" (wall), so this stays the fully-solid wall frame.
    const rows = ["~##", "###", "###"];
    expect(dungeonTileFrame(rows, 1, 1, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 0 });
  });

  it("picks the correct corner-blend frame for a known wall/floor corner", () => {
    // self=(1,1)=wall, tl=(0,0)=floor, tr=(1,0)=wall, bl=(0,1)=wall.
    // bit(tl=floor)=1, tr=0, bl=0, self(wall)=0 -> bitmask 1 -> base+16+1.
    const rows = [".##", "###", "###"];
    expect(dungeonTileFrame(rows, 1, 1, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 17 });
    expect(dungeonTileFrame(rows, 1, 1, 2)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 49 });
  });

  it("falls back to self at the grid edge (no out-of-bounds crash)", () => {
    expect(dungeonTileFrame(["#"], 0, 0, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 0 });
    expect(dungeonTileFrame(["."], 0, 0, 1)).toEqual({ key: TERRAIN_DUNGEON_KEY, frame: 1 });
  });
});
