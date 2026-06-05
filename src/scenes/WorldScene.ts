import Phaser from "phaser";
import { getNpcDialogue } from "../data/dialogues";
import { createDungeon } from "../data/dungeonService";
import { ENEMIES } from "../data/enemies";
import { ITEMS } from "../data/items";
import { BLOCKING_TILES, MAPS } from "../data/maps";
import { GAME_EVENTS, MAP_OFFSET_X, MAP_OFFSET_Y, TILE_SIZE } from "../game/constants";
import {
  addItem,
  ensureDungeonProgress,
  getGeneratedDungeonFloor,
  getItemCount,
  getSave,
  hasFlag,
  healPlayer,
  markFlag,
  persistSave,
  resetSave,
  restorePlayerMp,
  setCurrentDungeonFloor,
  setGeneratedDungeonFloor,
  setPlayerPosition
} from "../game/GameState";
import type {
  ChestDefinition,
  Direction,
  EnemySpawn,
  MapDefinition,
  MapId,
  NpcDefinition,
  TilePosition
} from "../game/types";

const directionVectors: Record<Direction, TilePosition> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 }
};

export class WorldScene extends Phaser.Scene {
  private currentMap!: MapDefinition;
  private player!: Phaser.GameObjects.Image;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private playerTile: TilePosition = { x: 0, y: 0 };
  private facing: Direction = "down";
  private moving = false;
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private dialogueBox?: Phaser.GameObjects.Rectangle;
  private dialogueAccent?: Phaser.GameObjects.Rectangle;
  private dialogueText?: Phaser.GameObjects.Text;
  private objectGroup?: Phaser.GameObjects.Group;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<string, Phaser.Input.Keyboard.Key>;
  private actionKeys?: Phaser.Input.Keyboard.Key[];
  private resetKey?: Phaser.Input.Keyboard.Key;
  private loadingMap = false;
  private menuOpen = false;

  constructor() {
    super("WorldScene");
  }

  create(): void {
    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.actionKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    ];
    this.resetKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.on("resume", this.refreshAfterBattle, this);
    this.game.events.on(GAME_EVENTS.menuClosed, this.handleMenuClosed, this);
    this.game.events.on(GAME_EVENTS.shopClosed, this.handleMenuClosed, this);
    this.events.once("shutdown", this.shutdown, this);

    const save = getSave();
    void this.loadMap(save.mapId, { x: save.x, y: save.y });
  }

  private shutdown(): void {
    this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.events.off("resume", this.refreshAfterBattle, this);
    this.game.events.off(GAME_EVENTS.menuClosed, this.handleMenuClosed, this);
    this.game.events.off(GAME_EVENTS.shopClosed, this.handleMenuClosed, this);
  }

  update(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0 || this.moving) {
      return;
    }

    if (this.resetKey && Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      resetSave();
      void this.loadMap("village", MAPS.village.spawn);
      this.game.events.emit(GAME_EVENTS.toast, "新しい冒険");
      this.game.events.emit(GAME_EVENTS.stateChanged);
      return;
    }

    const direction = this.getPressedDirection();
    if (direction) {
      this.tryMove(direction);
    }
  }

  private async loadMap(mapId: MapId, spawn: TilePosition): Promise<void> {
    this.loadingMap = true;
    try {
      const nextMap = await this.resolveMap(mapId);
      this.children.removeAll(true);
      this.currentMap = nextMap;
      this.objectGroup = this.add.group();
      const entryTile = this.isTerrainBlocked(spawn) ? this.currentMap.spawn : spawn;

      this.drawMap();
      this.createObjects();
      this.playerTile = { ...entryTile };
      this.playerShadow = this.add
        .ellipse(
          this.toWorldX(this.playerTile.x),
          this.toWorldY(this.playerTile.y) + 13,
          20,
          6,
          0x05080b,
          0.3
        )
        .setDepth(19);
      this.player = this.add.image(
        this.toWorldX(this.playerTile.x),
        this.toWorldY(this.playerTile.y),
        "player"
      );
      this.player.setDepth(20);
      this.createDialoguePanel();
      setPlayerPosition(mapId, entryTile.x, entryTile.y);
      this.game.events.emit(GAME_EVENTS.mapChanged, this.currentMap.name);
      this.game.events.emit(GAME_EVENTS.stateChanged);
    } finally {
      this.loadingMap = false;
    }
  }

  private async resolveMap(mapId: MapId): Promise<MapDefinition> {
    if (mapId !== "dungeon") {
      return MAPS[mapId];
    }

    const { floorCount, currentFloor } = ensureDungeonProgress();
    const generatedDungeon = getGeneratedDungeonFloor(currentFloor);
    if (generatedDungeon && this.hasSupplyChest(generatedDungeon)) {
      return generatedDungeon;
    }

    const previousFloor = currentFloor > 1 ? getGeneratedDungeonFloor(currentFloor - 1) : undefined;
    const previousDownStairs = previousFloor?.portals.find(
      (portal) => portal.kind === "stairs-down" && portal.toFloor === currentFloor
    );
    const upTarget = previousDownStairs
      ? { x: previousDownStairs.x, y: previousDownStairs.y }
      : undefined;

    this.game.events.emit(GAME_EVENTS.toast, `B${currentFloor}Fを生成中...`);
    const { dungeon, source } = await createDungeon(currentFloor, floorCount, upTarget);
    setGeneratedDungeonFloor(currentFloor, dungeon);
    this.game.events.emit(
      GAME_EVENTS.toast,
      source === "groq"
        ? `AIがB${currentFloor}Fを描き替えた`
        : `B${currentFloor}Fの地形が変化した`
    );
    return dungeon;
  }

  private drawMap(): void {
    const mapWidth = this.currentMap.rows[0].length * TILE_SIZE;
    const mapHeight = this.currentMap.rows.length * TILE_SIZE;
    this.add
      .rectangle(
        MAP_OFFSET_X + mapWidth / 2,
        MAP_OFFSET_Y + mapHeight / 2,
        mapWidth + 14,
        mapHeight + 14,
        0x070b0f,
        0.55
      )
      .setStrokeStyle(2, 0xd6b56a, 0.28)
      .setDepth(-2);

    for (let y = 0; y < this.currentMap.rows.length; y += 1) {
      for (let x = 0; x < this.currentMap.rows[y].length; x += 1) {
        const tile = this.currentMap.rows[y][x];
        const texture = this.getTileTexture(tile);
        this.add
          .image(MAP_OFFSET_X + x * TILE_SIZE, MAP_OFFSET_Y + y * TILE_SIZE, texture)
          .setOrigin(0)
          .setDepth(0);
      }
    }
  }

  private createObjects(): void {
    this.currentMap.portals.forEach((portal) => {
      const texture =
        portal.kind === "stairs-up"
          ? "tile-stairs-up"
          : portal.kind === "stairs-down"
            ? "tile-stairs-down"
            : "tile-portal";
      const portalImage = this.add
        .image(this.toWorldX(portal.x), this.toWorldY(portal.y), texture)
        .setDepth(5)
        .setAlpha(portal.kind ? 0.92 : 0.72);
      this.objectGroup?.add(portalImage);
      this.tweens.add({
        targets: portalImage,
        alpha: 1,
        scale: 1.08,
        yoyo: true,
        repeat: -1,
        duration: 900,
        ease: "Sine.easeInOut"
      });
    });

    this.currentMap.npcs.forEach((npc) => {
      this.addShadow(npc.x, npc.y, 11);
      this.objectGroup?.add(
        this.add.image(this.toWorldX(npc.x), this.toWorldY(npc.y), npc.texture).setDepth(12)
      );
    });

    this.currentMap.chests.forEach((chest) => {
      const opened = hasFlag(`${chest.id}-opened`);
      this.addShadow(chest.x, chest.y, 10);
      this.objectGroup?.add(
        this.add
          .image(this.toWorldX(chest.x), this.toWorldY(chest.y), opened ? "chest-open" : "chest-closed")
          .setDepth(11)
      );
    });

    this.currentMap.enemies
      .filter((enemy) => !getSave().defeatedEnemies.includes(enemy.id))
      .forEach((enemy) => {
        const texture = ENEMIES[enemy.enemyKey]?.texture ?? "enemy-goblin";
        this.addShadow(enemy.x, enemy.y, 10);
        this.objectGroup?.add(
          this.add.image(this.toWorldX(enemy.x), this.toWorldY(enemy.y), texture).setDepth(11)
        );
      });
  }

  private addShadow(tileX: number, tileY: number, depth: number): void {
    this.objectGroup?.add(
      this.add
        .ellipse(this.toWorldX(tileX), this.toWorldY(tileY) + 13, 20, 6, 0x05080b, 0.28)
        .setDepth(depth)
    );
  }

  private refreshAfterBattle(): void {
    void this.loadMap(this.currentMap.id, this.playerTile);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.loadingMap || this.menuOpen) {
      return;
    }

    if ((event.code === "KeyM" || event.code === "Escape") && this.canOpenMenu()) {
      this.openMenu();
      return;
    }

    if (this.dialogueLines.length > 0 && (event.code === "Space" || event.code === "Enter")) {
      this.advanceDialogue();
      return;
    }

    if (event.code === "Space" || event.code === "Enter") {
      this.tryInteract();
    }
  }

  private getPressedDirection(): Direction | undefined {
    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      return "left";
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      return "right";
    }
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      return "up";
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      return "down";
    }
    return undefined;
  }

  private tryMove(direction: Direction): void {
    this.facing = direction;
    const vector = directionVectors[direction];
    const target = {
      x: this.playerTile.x + vector.x,
      y: this.playerTile.y + vector.y
    };

    const enemy = this.enemyAt(target);
    if (enemy) {
      this.startBattle(enemy);
      return;
    }

    if (this.isBlocked(target)) {
      return;
    }

    this.moving = true;
    this.playerTile = target;
    setPlayerPosition(this.currentMap.id, target.x, target.y);
    this.tweens.add({
      targets: this.player,
      x: this.toWorldX(target.x),
      y: this.toWorldY(target.y),
      duration: 125,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.moving = false;
        void this.checkPortal();
      }
    });

    if (this.playerShadow) {
      this.tweens.add({
        targets: this.playerShadow,
        x: this.toWorldX(target.x),
        y: this.toWorldY(target.y) + 13,
        duration: 125,
        ease: "Sine.easeInOut"
      });
    }
  }

  private tryInteract(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0 || this.moving) {
      return;
    }

    const target = this.frontTile();
    const npc = this.npcAt(target);
    if (npc) {
      this.handleNpc(npc);
      return;
    }

    const chest = this.chestAt(target);
    if (chest) {
      void this.openChest(chest);
    }
  }

  private handleNpc(npc: NpcDefinition): void {
    if (npc.id === "shopkeeper") {
      this.openShop();
      return;
    }

    const dialogue = getNpcDialogue(npc.id);
    let stateChanged = false;

    if (npc.id === "healer") {
      if (getItemCount("herb") < 5) {
        addItem("herb", 1);
      }
      if (getItemCount("manaWater") < 2) {
        addItem("manaWater", 1);
      }
      healPlayer(getSave().maxHp);
      restorePlayerMp(getSave().maxMp);
      stateChanged = true;
    }

    if (npc.id === "elder" && !hasFlag("questAccepted")) {
      markFlag("questAccepted");
      stateChanged = true;
    }

    if (npc.id === "elder" && hasFlag("treasureFound") && !hasFlag("questComplete")) {
      const save = getSave();
      save.gold += 40;
      markFlag("questComplete");
      persistSave();
      stateChanged = true;
    }

    if (stateChanged) {
      this.game.events.emit(GAME_EVENTS.stateChanged);
    }

    this.showDialogue(dialogue);
  }

  private async openChest(chest: ChestDefinition): Promise<void> {
    if (hasFlag(`${chest.id}-opened`)) {
      this.showDialogue(["宝箱は空だ。"]);
      return;
    }

    const isRelicChest = chest.reward?.type === "relic" || chest.id === "relic-chest";
    if (isRelicChest && !getSave().defeatedEnemies.includes("dungeon-guardian")) {
      this.showDialogue(["守護者の紋章が刻まれた封印で開かない。"]);
      return;
    }

    markFlag(`${chest.id}-opened`);
    if (isRelicChest) {
      markFlag("treasureFound");
      this.game.events.emit(GAME_EVENTS.stateChanged);
      await this.loadMap(this.currentMap.id, this.playerTile);
      this.showDialogue([
        "太陽石を手に入れた。",
        "あたたかな光がストーンブルックへの帰路を照らしている。"
      ]);
      return;
    }

    if (chest.reward?.type === "item") {
      const item = ITEMS[chest.reward.itemId];
      addItem(chest.reward.itemId, chest.reward.quantity);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      await this.loadMap(this.currentMap.id, this.playerTile);
      const quantityText = chest.reward.quantity > 1 ? ` x${chest.reward.quantity}` : "";
      this.showDialogue(["宝箱を開けた。", `${item.name}${quantityText}を手に入れた。`]);
      return;
    }

    this.game.events.emit(GAME_EVENTS.stateChanged);
    await this.loadMap(this.currentMap.id, this.playerTile);
    this.showDialogue(["宝箱を開けた。"]);
  }

  private startBattle(enemy: EnemySpawn): void {
    if (this.menuOpen) {
      return;
    }

    this.scene.launch("BattleScene", {
      enemyInstanceId: enemy.id,
      enemyKey: enemy.enemyKey
    });
    this.scene.pause();
  }

  private canOpenMenu(): boolean {
    return !this.loadingMap && !this.menuOpen && this.dialogueLines.length === 0 && !this.moving;
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.scene.launch("MenuScene");
  }

  private openShop(): void {
    this.menuOpen = true;
    this.scene.launch("ShopScene");
  }

  private handleMenuClosed(): void {
    this.menuOpen = false;
  }

  private async checkPortal(): Promise<void> {
    const portal = this.currentMap.portals.find(
      (candidate) => candidate.x === this.playerTile.x && candidate.y === this.playerTile.y
    );

    if (!portal) {
      return;
    }

    if (portal.toMap === "dungeon") {
      ensureDungeonProgress();
      setCurrentDungeonFloor(portal.toFloor ?? 1);
    }
    await this.loadMap(portal.toMap, { x: portal.toX, y: portal.toY });
  }

  private isBlocked(position: TilePosition): boolean {
    const row = this.currentMap.rows[position.y];
    if (!row || position.x < 0 || position.x >= row.length) {
      return true;
    }

    const tile = row[position.x];
    if (BLOCKING_TILES.has(tile)) {
      return true;
    }

    return Boolean(this.npcAt(position) || this.chestAt(position));
  }

  private isTerrainBlocked(position: TilePosition): boolean {
    const row = this.currentMap.rows[position.y];
    if (!row || position.x < 0 || position.x >= row.length) {
      return true;
    }

    return BLOCKING_TILES.has(row[position.x]);
  }

  private enemyAt(position: TilePosition): EnemySpawn | undefined {
    return this.currentMap.enemies.find(
      (enemy) =>
        enemy.x === position.x &&
        enemy.y === position.y &&
        !getSave().defeatedEnemies.includes(enemy.id)
    );
  }

  private npcAt(position: TilePosition): NpcDefinition | undefined {
    return this.currentMap.npcs.find((npc) => npc.x === position.x && npc.y === position.y);
  }

  private chestAt(position: TilePosition): ChestDefinition | undefined {
    return this.currentMap.chests.find((chest) => chest.x === position.x && chest.y === position.y);
  }

  private frontTile(): TilePosition {
    const vector = directionVectors[this.facing];
    return {
      x: this.playerTile.x + vector.x,
      y: this.playerTile.y + vector.y
    };
  }

  private showDialogue(lines: string[]): void {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueBox?.setVisible(true);
    this.dialogueAccent?.setVisible(true);
    this.dialogueText?.setVisible(true);
    this.dialogueText?.setText(lines[0]);
  }

  private advanceDialogue(): void {
    this.dialogueIndex += 1;
    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.dialogueLines = [];
      this.dialogueBox?.setVisible(false);
      this.dialogueAccent?.setVisible(false);
      this.dialogueText?.setVisible(false);
      return;
    }

    this.dialogueText?.setText(this.dialogueLines[this.dialogueIndex]);
  }

  private createDialoguePanel(): void {
    this.dialogueBox = this.add
      .rectangle(400, 535, 688, 92, 0x101722, 0.97)
      .setStrokeStyle(2, 0xd6b56a, 0.95)
      .setDepth(40)
      .setVisible(false);
    this.dialogueAccent = this.add
      .rectangle(400, 493, 650, 2, 0xf0d98a, 0.8)
      .setDepth(41)
      .setVisible(false);
    this.dialogueText = this.add
      .text(96, 504, "", {
        fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
        fontSize: "18px",
        color: "#fff4cf",
        wordWrap: { width: 608, useAdvancedWrap: true },
        lineSpacing: 8
      })
      .setDepth(41)
      .setVisible(false);
  }

  private getTileTexture(tile: string): string {
    switch (tile) {
      case ",":
      case "S":
      case "G":
        return "tile-tall-grass";
      case "=":
        return "tile-path";
      case "~":
        return "tile-water";
      case "H":
        return "tile-house";
      case "#":
        return this.currentMap.id === "dungeon" ? "tile-cave" : "tile-tree";
      case "^":
      case "C":
        return "tile-rock";
      case "O":
        return "tile-path";
      case "B":
      case "D":
      case "T":
      case "U":
      case "V":
        return "tile-floor";
      default:
        return this.currentMap.id === "dungeon" ? "tile-floor" : "tile-grass";
    }
  }

  private toWorldX(tileX: number): number {
    return MAP_OFFSET_X + tileX * TILE_SIZE + TILE_SIZE / 2;
  }

  private toWorldY(tileY: number): number {
    return MAP_OFFSET_Y + tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  private hasSupplyChest(map: MapDefinition): boolean {
    return map.chests.some((chest) => chest.reward?.type === "item");
  }
}
