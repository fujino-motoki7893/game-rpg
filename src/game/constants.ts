export const TILE_SIZE = 32;
// The world is now larger than the viewport and the camera follows the
// player, so maps are drawn starting at the world origin (no static margin).
export const MAP_OFFSET_X = 0;
export const MAP_OFFSET_Y = 0;
export const SAVE_KEY = "tiny-turn-rpg-save-v1";

export const GAME_EVENTS = {
  stateChanged: "state-changed",
  mapChanged: "map-changed",
  toast: "toast",
  menuClosed: "menu-closed",
  shopClosed: "shop-closed",
  escapeDungeon: "escape-dungeon"
} as const;
