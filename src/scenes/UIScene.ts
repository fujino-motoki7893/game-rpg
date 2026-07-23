import Phaser from "phaser";
import { getDungeonNameForTier } from "../data/dungeonGenerator";
import { BLOCKING_TILES, getMapDefinition } from "../data/maps";
import { GAME_EVENTS } from "../game/constants";
import {
  getActiveDungeonTier,
  getCompanionHp,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getCompanionMp,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  isExpandedWorldUnlocked,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion,
  hasFlag
} from "../game/GameState";
import { getObjective } from "../data/dialogues";
import type { MapDefinition, NpcDefinition, TilePosition } from "../game/types";

const MINIMAP_SIZE = 128;
const MINIMAP_RIGHT = 776;
const MINIMAP_BOTTOM = 514;
const MINIMAP_PADDING = 6;
const MINIMAP_CENTER_X = MINIMAP_RIGHT - MINIMAP_SIZE / 2;
const MINIMAP_CENTER_Y = MINIMAP_BOTTOM - MINIMAP_SIZE / 2;
const DUNGEON_REVEAL_RADIUS = 2;

export class UIScene extends Phaser.Scene {
  private objectiveText?: Phaser.GameObjects.Text;
  private mapText?: Phaser.GameObjects.Text;
  private playerStatusText?: Phaser.GameObjects.Text;
  private lunaStatusText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private minimapTiles?: Phaser.GameObjects.Graphics;
  private minimapPlayerDot?: Phaser.GameObjects.Arc;
  private minimapTransform = { offsetX: 0, offsetY: 0, scale: 1 };
  private currentMapDef?: MapDefinition;
  private dungeonRevealed = new WeakMap<MapDefinition, Set<number>>();

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.add.rectangle(400, 30, 800, 60, 0x0c1319, 0.96);
    this.add.rectangle(400, 60, 800, 2, 0xd6b56a, 0.72);
    this.add.rectangle(400, 64, 800, 3, 0x000000, 0.22);
    this.add.rectangle(400, 582, 800, 116, 0x0c1319, 0.9);
    this.add.rectangle(400, 524, 800, 2, 0xd6b56a, 0.65);
    this.add.text(24, 552, "目的", this.textStyle(13, "#d6b56a"));
    this.objectiveText = this.add.text(76, 552, "", this.textStyle(17, "#e6d7a8"));
    this.mapText = this.add.text(776, 532, "", this.textStyle(18, "#a9d8ff")).setOrigin(1, 0);
    this.playerStatusText = this.add
      .text(776, 554, "", this.textStyle(16, "#f4df7e"))
      .setOrigin(1, 0);
    this.lunaStatusText = this.add
      .text(776, 576, "", this.textStyle(16, "#b28aff"))
      .setOrigin(1, 0);
    this.add.text(
      24,
      612,
      "操作: 移動 矢印/WASD  決定 Space/Enter  メニュー M/Esc  ルナと話す L  リセット R",
      this.textStyle(14, "#9fb4c6")
    );
    this.toastText = this.add
      .text(400, 505, "", this.textStyle(16, "#ffffff"))
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.add
      .rectangle(MINIMAP_CENTER_X, MINIMAP_CENTER_Y, MINIMAP_SIZE, MINIMAP_SIZE, 0x0c1319, 0.85)
      .setStrokeStyle(2, 0xd6b56a, 0.7);
    this.minimapTiles = this.add.graphics();
    this.minimapPlayerDot = this.add.circle(0, 0, 3, 0xf4df7e).setVisible(false);

    this.game.events.on(GAME_EVENTS.stateChanged, this.refresh, this);
    this.game.events.on(GAME_EVENTS.mapChanged, this.handleMapChanged, this);
    this.game.events.on(GAME_EVENTS.playerMoved, this.updateMinimapPlayer, this);
    this.game.events.on(GAME_EVENTS.toast, this.showToast, this);
    this.refresh();
  }

  shutdown(): void {
    this.game.events.off(GAME_EVENTS.stateChanged, this.refresh, this);
    this.game.events.off(GAME_EVENTS.mapChanged, this.handleMapChanged, this);
    this.game.events.off(GAME_EVENTS.playerMoved, this.updateMinimapPlayer, this);
    this.game.events.off(GAME_EVENTS.toast, this.showToast, this);
  }

  private refresh(): void {
    const save = getSave();
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    this.playerStatusText?.setText(`Lv ${save.level}  HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`);
    if (hasCompanion()) {
      this.lunaStatusText?.setText(
        `ルナ Lv ${save.level}  HP ${getCompanionHp()}/${getCompanionMaxHp()}  MP ${getCompanionMp()}/${getCompanionMaxMp()}`
      );
    } else {
      this.lunaStatusText?.setText("");
    }
    this.objectiveText?.setText(getObjective());
    const mapName =
      save.mapId === "dungeon"
        ? `${getDungeonNameForTier(getActiveDungeonTier())} B${getCurrentDungeonFloor()}F/${getDungeonFloorCount() ?? "?"}F`
        : getMapDefinition(save.mapId, isExpandedWorldUnlocked()).name;
    this.mapText?.setText(mapName);
  }

  private handleMapChanged(mapName: string, map: MapDefinition): void {
    this.mapText?.setText(mapName);
    this.currentMapDef = map;
    this.redrawMinimap(map);
  }

  private getRevealedTiles(map: MapDefinition): Set<number> {
    let revealed = this.dungeonRevealed.get(map);
    if (!revealed) {
      revealed = new Set<number>();
      this.dungeonRevealed.set(map, revealed);
    }
    return revealed;
  }

  private revealDungeonTiles(map: MapDefinition, center: TilePosition): void {
    const revealed = this.getRevealedTiles(map);
    for (let dy = -DUNGEON_REVEAL_RADIUS; dy <= DUNGEON_REVEAL_RADIUS; dy += 1) {
      const y = center.y + dy;
      const row = map.rows[y];
      if (!row) {
        continue;
      }
      for (let dx = -DUNGEON_REVEAL_RADIUS; dx <= DUNGEON_REVEAL_RADIUS; dx += 1) {
        const x = center.x + dx;
        if (x < 0 || x >= row.length) {
          continue;
        }
        revealed.add(y * row.length + x);
      }
    }
  }

  private redrawMinimap(map: MapDefinition): void {
    const graphics = this.minimapTiles;
    const rows = map.rows;
    if (!graphics || rows.length === 0 || rows[0].length === 0) {
      return;
    }

    graphics.clear();
    const cols = rows[0].length;
    const innerSize = MINIMAP_SIZE - MINIMAP_PADDING * 2;
    const scale = Math.min(innerSize / cols, innerSize / rows.length);
    const drawWidth = cols * scale;
    const drawHeight = rows.length * scale;
    const offsetX = MINIMAP_CENTER_X - MINIMAP_SIZE / 2 + MINIMAP_PADDING + (innerSize - drawWidth) / 2;
    const offsetY = MINIMAP_CENTER_Y - MINIMAP_SIZE / 2 + MINIMAP_PADDING + (innerSize - drawHeight) / 2;
    this.minimapTransform = { offsetX, offsetY, scale };

    const isDungeon = map.id === "dungeon";
    const revealed = isDungeon ? this.getRevealedTiles(map) : undefined;

    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        if (revealed && !revealed.has(y * cols + x)) {
          continue;
        }
        const blocked = BLOCKING_TILES.has(rows[y][x]);
        graphics.fillStyle(blocked ? 0x10171d : 0x4d6f95, blocked ? 0.4 : 0.95);
        graphics.fillRect(offsetX + x * scale, offsetY + y * scale, scale + 0.5, scale + 0.5);
      }
    }

    graphics.fillStyle(0xd6b56a, 0.9);
    map.portals.forEach((portal) => {
      if (revealed && !revealed.has(portal.y * cols + portal.x)) {
        return;
      }
      graphics.fillCircle(
        offsetX + (portal.x + 0.5) * scale,
        offsetY + (portal.y + 0.5) * scale,
        Math.max(1.5, scale * 0.35)
      );
    });

    map.chests.forEach((chest) => {
      if (revealed && !revealed.has(chest.y * cols + chest.x)) {
        return;
      }
      const size = Math.max(3, scale * 0.6);
      const chestX = offsetX + (chest.x + 0.5) * scale - size / 2;
      const chestY = offsetY + (chest.y + 0.5) * scale - size / 2;
      if (hasFlag(`${chest.id}-opened`)) {
        graphics.lineStyle(1, 0xe0a458, 0.55);
        graphics.strokeRect(chestX, chestY, size, size);
      } else {
        graphics.fillStyle(0xe0a458, 0.95);
        graphics.fillRect(chestX, chestY, size, size);
      }
    });

    graphics.fillStyle(0x7fe3c0, 0.95);
    map.npcs.forEach((npc) => {
      if (!this.isNpcVisible(npc)) {
        return;
      }
      if (revealed && !revealed.has(npc.y * cols + npc.x)) {
        return;
      }
      graphics.fillCircle(
        offsetX + (npc.x + 0.5) * scale,
        offsetY + (npc.y + 0.5) * scale,
        Math.max(1.5, scale * 0.3)
      );
    });
  }

  private isNpcVisible(npc: NpcDefinition): boolean {
    return (!npc.requiresFlag || hasFlag(npc.requiresFlag)) && (!npc.hiddenIfFlag || !hasFlag(npc.hiddenIfFlag));
  }

  private updateMinimapPlayer(position: TilePosition): void {
    const map = this.currentMapDef;
    if (map) {
      if (map.id === "dungeon") {
        this.revealDungeonTiles(map, position);
      }
      this.redrawMinimap(map);
    }

    const { offsetX, offsetY, scale } = this.minimapTransform;
    this.minimapPlayerDot
      ?.setPosition(offsetX + (position.x + 0.5) * scale, offsetY + (position.y + 0.5) * scale)
      .setVisible(true);
  }

  private showToast(message: string): void {
    this.toastTimer?.remove(false);
    this.toastText?.setText(message).setVisible(true);
    this.toastTimer = this.time.delayedCall(1800, () => {
      this.toastText?.setVisible(false);
    });
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
