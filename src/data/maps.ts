import type { MapDefinition } from "../game/types";

export const MAPS: Record<string, MapDefinition> = {
  village: {
    id: "village",
    name: "ストーンブルック村",
    spawn: { x: 9, y: 6 },
    rows: [
      "####################",
      "#....H......H......#",
      "#....H......H......#",
      "#..................#",
      "#..E...====........#",
      "#......=..=....N...#",
      "#......=..=........#",
      "#......====........#",
      "#...H..........H...#",
      "#...H..........H...#",
      "#..................#",
      "#~~~~.........~~~~~#",
      "#~~~~...====..~~~~~#",
      "#.........O........#",
      "####################"
    ],
    portals: [{ x: 10, y: 13, toMap: "field", toX: 10, toY: 1 }],
    npcs: [
      { id: "elder", name: "村長ローアン", texture: "npc-elder", x: 3, y: 4 },
      { id: "healer", name: "ミラ", texture: "npc-healer", x: 15, y: 5 },
      { id: "shopkeeper", name: "道具屋ニコ", texture: "npc-shopkeeper", x: 6, y: 10 }
    ],
    chests: [],
    enemies: []
  },
  field: {
    id: "field",
    name: "月明かりの草原",
    spawn: { x: 10, y: 1 },
    rows: [
      "####################",
      "#.........O........#",
      "#..,,,,......,,,,..#",
      "#..,,....S...,,,,..#",
      "#.............G....#",
      "#~~~~....====......#",
      "#~~~~....=..=......#",
      "#........====..^^^^#",
      "#..,,,,.........^C^#",
      "#..,,,,.....G...^^^#",
      "#..................#",
      "#...S..............#",
      "#^...^.........~~~~#",
      "#^O..^....,,,,..~~~#",
      "####################"
    ],
    portals: [
      { x: 10, y: 1, toMap: "village", toX: 10, toY: 13 },
      { x: 2, y: 13, toMap: "dungeon", toX: 1, toY: 1 }
    ],
    npcs: [],
    chests: [],
    enemies: [
      { id: "field-slime-a", enemyKey: "slime", x: 9, y: 3 },
      { id: "field-slime-b", enemyKey: "slime", x: 4, y: 11 },
      { id: "field-goblin-a", enemyKey: "goblin", x: 14, y: 4 },
      { id: "field-goblin-b", enemyKey: "goblin", x: 13, y: 9 }
    ]
  },
  dungeon: {
    id: "dungeon",
    name: "エンバーフォール洞窟",
    spawn: { x: 1, y: 1 },
    rows: [
      "####################",
      "#O.................#",
      "#.######..########.#",
      "#......#..#........#",
      "#.####.#..#.####...#",
      "#.#....#..#....#...#",
      "#.#.~~~~..~~~~.#...#",
      "#.#.~~~~..~~~~.#.G.#",
      "#.#............#...#",
      "#.######..######...#",
      "#.................T#",
      "#....G.............#",
      "#..............B...#",
      "#..............D...#",
      "####################"
    ],
    portals: [{ x: 1, y: 1, toMap: "field", toX: 2, toY: 13 }],
    npcs: [],
    chests: [{ id: "relic-chest", x: 15, y: 12 }],
    enemies: [
      { id: "dungeon-bat-1", enemyKey: "bat", x: 17, y: 7 },
      { id: "dungeon-skeleton-2", enemyKey: "skeleton", x: 5, y: 11 },
      { id: "dungeon-mage-3", enemyKey: "mage", x: 10, y: 10 },
      { id: "dungeon-guardian", enemyKey: "guardian", x: 15, y: 13 }
    ]
  }
};

export const BLOCKING_TILES = new Set(["#", "H", "~", "^"]);
