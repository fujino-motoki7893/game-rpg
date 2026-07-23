export const TILE_SIZE = 32;
// The world is now larger than the viewport and the camera follows the
// player, so maps are drawn starting at the world origin (no static margin).
export const MAP_OFFSET_X = 0;
export const MAP_OFFSET_Y = 0;
export const SAVE_KEY = "tiny-turn-rpg-save-v1";

// Height of the opaque HUD bars UIScene draws over the top and bottom of the
// 800x640 canvas. The world camera's bounds are padded by these amounts so it
// can scroll past the map's true edge rows/columns instead of leaving them
// permanently hidden behind the HUD when the player stands near an edge.
export const HUD_TOP_HEIGHT = 64;
export const HUD_BOTTOM_HEIGHT = 116;

export const GAME_EVENTS = {
  stateChanged: "state-changed",
  mapChanged: "map-changed",
  playerMoved: "player-moved",
  toast: "toast",
  menuClosed: "menu-closed",
  shopClosed: "shop-closed",
  escapeDungeon: "escape-dungeon"
} as const;
