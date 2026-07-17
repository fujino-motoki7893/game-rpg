import Phaser from "phaser";
import {
  getCharacterIdleAnimationKey,
  getCharacterOriginY,
  getCharacterWalkAnimationKey
} from "../data/characterSprites";
import {
  fetchLunaLine,
  getCurrentLunaStage,
  getLunaLine,
  getNextStaticLunaLine,
  getNpcDialogue
} from "../data/dialogues";
import { getFieldDungeonEntranceForTier } from "../data/dungeonGenerator";
import { createDungeon } from "../data/dungeonService";
import { ENEMIES } from "../data/enemies";
import { EQUIPMENT } from "../data/equipment";
import { ITEMS } from "../data/items";
import { BLOCKING_TILES, getMapDefinition, MAPS } from "../data/maps";
import { GAME_EVENTS, MAP_OFFSET_X, MAP_OFFSET_Y, TILE_SIZE } from "../game/constants";
import {
  addItem,
  addEquipment,
  ensureDungeonProgress,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getGeneratedDungeonFloor,
  getDungeonTier,
  getItemCount,
  getPlayerAttack,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion,
  hasFlag,
  healCompanion,
  healPlayer,
  isExpandedWorldUnlocked,
  markFlag,
  persistSave,
  recruitCompanion,
  resetDungeonProgress,
  resetSave,
  resetDungeonEnemyDefeats,
  resetFieldEnemyDefeats,
  restoreCompanionMp,
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

type ShopKind = "item" | "equipment";

const directionVectors: Record<Direction, TilePosition> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 }
};
const ENEMY_AWARENESS_RANGE = 4;
const ENEMY_DECISION_INTERVAL_MS = 900;
const ENEMY_MOVE_DURATION_MS = 180;
const ENEMY_WEAKNESS_RATIO = 0.85;
const ENEMY_PATROL_PATTERNS: Direction[][] = [
  ["left", "right"],
  ["up", "down"],
  ["left", "up", "right", "down"],
  ["right", "down", "left", "up"]
];

interface EnemyVisual {
  enemy: EnemySpawn;
  image: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  tile: TilePosition;
  patrolStep: number;
  nextMoveAt: number;
}

export class WorldScene extends Phaser.Scene {
  private currentMap!: MapDefinition;
  private player!: Phaser.GameObjects.Sprite;
  private playerShadow?: Phaser.GameObjects.Ellipse;
  private playerTile: TilePosition = { x: 0, y: 0 };
  private facing: Direction = "down";
  private moving = false;
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private dialogueBox?: Phaser.GameObjects.Rectangle;
  private dialogueAccent?: Phaser.GameObjects.Rectangle;
  private dialogueText?: Phaser.GameObjects.Text;
  private lunaFieldRequestToken = 0;
  private targetHintBox?: Phaser.GameObjects.Rectangle;
  private targetHintText?: Phaser.GameObjects.Text;
  private objectGroup?: Phaser.GameObjects.Group;
  private enemyObjects = new Map<string, EnemyVisual>();
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
    this.game.events.on(GAME_EVENTS.escapeDungeon, this.escapeDungeon, this);
    this.events.once("shutdown", this.shutdown, this);

    const save = getSave();
    void this.loadMap(save.mapId, { x: save.x, y: save.y });
  }

  private shutdown(): void {
    this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.events.off("resume", this.refreshAfterBattle, this);
    this.game.events.off(GAME_EVENTS.menuClosed, this.handleMenuClosed, this);
    this.game.events.off(GAME_EVENTS.shopClosed, this.handleMenuClosed, this);
    this.game.events.off(GAME_EVENTS.escapeDungeon, this.escapeDungeon, this);
  }

  update(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0) {
      this.hideTargetHint();
      return;
    }

    if (this.moving) {
      return;
    }

    this.updateEnemyMovement();
    this.refreshTargetHint();

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
      this.player = this.add.sprite(
        this.toWorldX(this.playerTile.x),
        this.toWorldY(this.playerTile.y),
        "player",
        0
      );
      this.alignCharacterSprite(this.player, "player").setDepth(20);
      this.playCharacterIdle(this.player, "player", this.facing);
      this.createDialoguePanel();
      this.createTargetHintPanel();
      this.setupCamera();
      setPlayerPosition(mapId, entryTile.x, entryTile.y);
      this.game.events.emit(GAME_EVENTS.mapChanged, this.currentMap.name);
      this.game.events.emit(GAME_EVENTS.stateChanged);
    } finally {
      this.loadingMap = false;
      this.refreshTargetHint();
    }
  }

  private setupCamera(): void {
    const mapPixelWidth = this.currentMap.rows[0].length * TILE_SIZE;
    const mapPixelHeight = this.currentMap.rows.length * TILE_SIZE;
    const camera = this.cameras.main;
    camera.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    camera.startFollow(this.player, true, 1, 1);
  }

  private async resolveMap(mapId: MapId): Promise<MapDefinition> {
    if (mapId !== "dungeon") {
      return getMapDefinition(mapId, isExpandedWorldUnlocked());
    }

    const dungeonTier = getDungeonTier();
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
    const { dungeon, source } = await createDungeon(currentFloor, floorCount, upTarget, dungeonTier);
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
    this.enemyObjects.clear();
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

    this.getActiveNpcs().forEach((npc) => {
      this.addShadow(npc.x, npc.y, 11);
      const sprite = this.add.sprite(this.toWorldX(npc.x), this.toWorldY(npc.y), npc.texture, 0);
      this.alignCharacterSprite(sprite, npc.texture).setDepth(12);
      this.playCharacterIdle(sprite, npc.texture);
      this.objectGroup?.add(sprite);
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
      .forEach((enemy, index) => {
        const texture = ENEMIES[enemy.enemyKey]?.texture ?? "enemy-goblin";
        const shadow = this.addShadow(enemy.x, enemy.y, 10);
        const image = this.add.sprite(this.toWorldX(enemy.x), this.toWorldY(enemy.y), texture, 0);
        this.alignCharacterSprite(image, texture).setDepth(11);
        this.playCharacterIdle(image, texture);
        this.objectGroup?.add(image);
        this.enemyObjects.set(enemy.id, {
          enemy,
          image,
          shadow,
          tile: { x: enemy.x, y: enemy.y },
          patrolStep: this.hashId(enemy.id) % 4,
          nextMoveAt: this.time.now + ENEMY_DECISION_INTERVAL_MS + index * 160
        });
      });
  }

  private addShadow(tileX: number, tileY: number, depth: number): Phaser.GameObjects.Ellipse {
    const shadow = this.add
      .ellipse(this.toWorldX(tileX), this.toWorldY(tileY) + 13, 20, 6, 0x05080b, 0.28)
      .setDepth(depth);
    this.objectGroup?.add(shadow);
    return shadow;
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
      return;
    }

    if (event.code === "KeyL") {
      this.talkToCompanion();
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
    this.playCharacterIdle(this.player, "player", direction);
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
      this.refreshTargetHint();
      return;
    }

    this.moving = true;
    this.hideTargetHint();
    this.playerTile = target;
    this.playCharacterWalk(this.player, "player", direction);
    setPlayerPosition(this.currentMap.id, target.x, target.y);
    this.tweens.add({
      targets: this.player,
      x: this.toWorldX(target.x),
      y: this.toWorldY(target.y),
      duration: 125,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.moving = false;
        this.playCharacterIdle(this.player, "player", direction);
        void this.checkPortal();
        this.refreshTargetHint();
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

  private updateEnemyMovement(): void {
    if (this.enemyObjects.size === 0) {
      return;
    }

    const now = this.time.now;
    this.enemyObjects.forEach((enemyObject) => {
      if (now < enemyObject.nextMoveAt || !enemyObject.image.active) {
        return;
      }

      enemyObject.nextMoveAt = now + ENEMY_DECISION_INTERVAL_MS;
      const nextTile = this.chooseEnemyNextTile(enemyObject);
      if (!nextTile) {
        return;
      }

      this.moveEnemy(enemyObject, nextTile);
    });
  }

  private chooseEnemyNextTile(enemyObject: EnemyVisual): TilePosition | undefined {
    if (this.shouldEnemyFlee(enemyObject)) {
      return this.chooseFleeTile(enemyObject);
    }

    return this.choosePatrolTile(enemyObject);
  }

  private shouldEnemyFlee(enemyObject: EnemyVisual): boolean {
    return (
      this.distance(enemyObject.tile, this.playerTile) <= ENEMY_AWARENESS_RANGE &&
      this.isEnemyWeakerThanPlayer(enemyObject.enemy)
    );
  }

  private chooseFleeTile(enemyObject: EnemyVisual): TilePosition | undefined {
    const currentDistance = this.distance(enemyObject.tile, this.playerTile);
    const options = this.getEnemyMoveOptions(enemyObject)
      .map((position) => ({
        position,
        distance: this.distance(position, this.playerTile)
      }))
      .filter((option) => option.distance > currentDistance)
      .sort((a, b) => b.distance - a.distance);

    return options[0]?.position;
  }

  private choosePatrolTile(enemyObject: EnemyVisual): TilePosition | undefined {
    const pattern = ENEMY_PATROL_PATTERNS[this.hashId(enemyObject.enemy.id) % ENEMY_PATROL_PATTERNS.length];
    for (let attempts = 0; attempts < pattern.length; attempts += 1) {
      const direction = pattern[(enemyObject.patrolStep + attempts) % pattern.length];
      const candidate = this.offsetPosition(enemyObject.tile, direction);
      if (this.canEnemyOccupy(candidate, enemyObject.enemy.id)) {
        enemyObject.patrolStep = (enemyObject.patrolStep + attempts + 1) % pattern.length;
        return candidate;
      }
    }

    enemyObject.patrolStep = (enemyObject.patrolStep + 1) % pattern.length;
    return undefined;
  }

  private getEnemyMoveOptions(enemyObject: EnemyVisual): TilePosition[] {
    return (Object.keys(directionVectors) as Direction[])
      .map((direction) => this.offsetPosition(enemyObject.tile, direction))
      .filter((position) => this.canEnemyOccupy(position, enemyObject.enemy.id));
  }

  private moveEnemy(enemyObject: EnemyVisual, tile: TilePosition): void {
    const direction = this.getDirectionBetween(enemyObject.tile, tile);
    enemyObject.tile = tile;
    const texture = ENEMIES[enemyObject.enemy.enemyKey]?.texture ?? "enemy-goblin";
    if (direction) {
      this.playCharacterWalk(enemyObject.image, texture, direction);
    }
    this.tweens.add({
      targets: enemyObject.image,
      x: this.toWorldX(tile.x),
      y: this.toWorldY(tile.y),
      duration: ENEMY_MOVE_DURATION_MS,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.playCharacterIdle(enemyObject.image, texture, direction ?? "down");
      }
    });
    this.tweens.add({
      targets: enemyObject.shadow,
      x: this.toWorldX(tile.x),
      y: this.toWorldY(tile.y) + 13,
      duration: ENEMY_MOVE_DURATION_MS,
      ease: "Sine.easeInOut"
    });
    this.refreshTargetHint();
  }

  private tryInteract(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0 || this.moving) {
      return;
    }

    const target = this.frontTile();
    const npc = this.npcAt(target);
    if (npc) {
      void this.handleNpc(npc);
      return;
    }

    const chest = this.chestAt(target);
    if (chest) {
      void this.openChest(chest);
    }
  }

  private talkToCompanion(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0 || this.moving) {
      return;
    }

    if (!hasCompanion()) {
      return;
    }

    const stage = getCurrentLunaStage();
    const staticLine = getNextStaticLunaLine(stage);
    if (staticLine) {
      this.showDialogue([staticLine]);
      return;
    }

    const placeholder = "ルナ: ……";
    const requestToken = ++this.lunaFieldRequestToken;
    this.showDialogue([placeholder]);

    fetchLunaLine(stage)
      .catch(() => getLunaLine())
      .then((line) => {
        if (requestToken !== this.lunaFieldRequestToken) {
          return;
        }
        if (this.dialogueLines.length === 1 && this.dialogueLines[0] === placeholder) {
          this.dialogueLines = [line];
          this.dialogueText?.setText(line);
        }
      });
  }

  private async handleNpc(npc: NpcDefinition): Promise<void> {
    if (npc.id === "shopkeeper") {
      this.openShop("item");
      return;
    }

    if (npc.id === "equipmentShopkeeper") {
      this.openShop("equipment");
      return;
    }

    let dialogue: string[] | undefined;
    let stateChanged = false;
    let shouldReloadMap = false;

    if (npc.id === "healer") {
      if (getItemCount("herb") < 5) {
        addItem("herb", 1);
      }
      if (getItemCount("manaWater") < 2) {
        addItem("manaWater", 1);
      }
      healPlayer(getPlayerMaxHp());
      restorePlayerMp(getPlayerMaxMp());
      if (hasCompanion()) {
        healCompanion(getCompanionMaxHp());
        restoreCompanionMp(getCompanionMaxMp());
      }
      stateChanged = true;
    }

    if (npc.id === "luna") {
      recruitCompanion();
      stateChanged = true;
      shouldReloadMap = true;
      dialogue = [
        "ルナ: 太陽石を取り戻したのですね。",
        "ルナ: でも、次の月影石は深い洞窟の奥。一人で挑むには荷が重いはず。",
        "ルナ: 私が手助けしましょう。仲間に加えてください。",
        "ルナが仲間になった！"
      ];
    }

    if (npc.id === "elder") {
      if (!hasFlag("questAccepted")) {
        markFlag("questAccepted");
        stateChanged = true;
        dialogue = getNpcDialogue(npc.id);
      } else if (hasFlag("treasureFound") && !hasFlag("questComplete")) {
        const save = getSave();
        save.gold += 40;
        markFlag("questComplete");
        markFlag("secondQuestAccepted");
        resetDungeonEnemyDefeats();
        resetFieldEnemyDefeats();
        resetDungeonProgress();
        persistSave();
        stateChanged = true;
        shouldReloadMap = true;
        dialogue = [
          "村長ローアン: 太陽石を取り戻してくれたのだな。",
          "金貨40枚を受け取った。",
          "村の北門と草原の東道が開かれた。",
          "クエスト開始: 月影石を探す"
        ];
      } else if (hasFlag("secondTreasureFound") && !hasFlag("secondQuestComplete")) {
        const save = getSave();
        save.gold += 120;
        markFlag("secondQuestComplete");
        persistSave();
        stateChanged = true;
        dialogue = [
          "村長ローアン: 月影石まで持ち帰ってくれたのか。",
          "金貨120枚を受け取った。",
          "太陽石と月影石が呼応し、村を包む結界が強く輝いた。"
        ];
      } else if (hasFlag("questComplete") && !hasFlag("secondQuestAccepted")) {
        markFlag("secondQuestAccepted");
        stateChanged = true;
        dialogue = getNpcDialogue(npc.id);
      }
    }

    if (stateChanged) {
      this.game.events.emit(GAME_EVENTS.stateChanged);
    }

    if (shouldReloadMap) {
      await this.loadMap(this.currentMap.id, this.playerTile);
    }

    this.showDialogue(dialogue ?? getNpcDialogue(npc.id));
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
      const dungeonTier = getDungeonTier();
      const relicName = dungeonTier >= 2 ? "月影石" : "太陽石";
      markFlag(dungeonTier >= 2 ? "secondTreasureFound" : "treasureFound");
      resetDungeonEnemyDefeats();
      setCurrentDungeonFloor(1);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      await this.loadMap("field", this.getFieldDungeonEntrance(dungeonTier));
      this.showDialogue([
        `${relicName}を手に入れた。`,
        dungeonTier >= 2
          ? "深い闇がほどけ、草原の新しい洞窟入口へ導かれた。"
          : "あたたかな光に包まれ、洞窟の外へ導かれた。"
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

    if (chest.reward?.type === "equipment") {
      const equipment = EQUIPMENT[chest.reward.equipmentId];
      addEquipment(chest.reward.equipmentId, chest.reward.quantity);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      await this.loadMap(this.currentMap.id, this.playerTile);
      const quantityText = chest.reward.quantity > 1 ? ` x${chest.reward.quantity}` : "";
      this.showDialogue(["宝箱を開けた。", `${equipment.name}${quantityText}を手に入れた。`]);
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
    this.hideTargetHint();
    this.scene.launch("MenuScene");
  }

  private openShop(shopKind: ShopKind): void {
    this.menuOpen = true;
    this.hideTargetHint();
    this.scene.launch("ShopScene", { shopKind });
  }

  private handleMenuClosed(): void {
    this.menuOpen = false;
  }

  private async escapeDungeon(): Promise<void> {
    if (this.loadingMap || this.currentMap?.id !== "dungeon") {
      return;
    }

    this.menuOpen = false;
    resetDungeonEnemyDefeats();
    setCurrentDungeonFloor(1);
    await this.loadMap("field", this.getFieldDungeonEntrance());
    this.game.events.emit(GAME_EVENTS.toast, "帰還の羽で草原へ脱出した");
  }

  private getFieldDungeonEntrance(tier = getDungeonTier()): TilePosition {
    return { ...getFieldDungeonEntranceForTier(tier) };
  }

  private async checkPortal(): Promise<void> {
    const portal = this.currentMap.portals.find(
      (candidate) => candidate.x === this.playerTile.x && candidate.y === this.playerTile.y
    );

    if (!portal) {
      return;
    }

    this.applyRespawnRules(this.currentMap.id, portal.toMap);

    if (portal.toMap === "dungeon") {
      ensureDungeonProgress();
      setCurrentDungeonFloor(portal.toFloor ?? 1);
    }
    await this.loadMap(portal.toMap, { x: portal.toX, y: portal.toY });
  }

  private applyRespawnRules(fromMapId: MapId, toMapId: MapId): void {
    if (fromMapId !== "field" && toMapId === "field") {
      resetFieldEnemyDefeats();
    }

    if (fromMapId === "dungeon" && toMapId !== "dungeon") {
      resetDungeonEnemyDefeats();
    }

    if (fromMapId !== "dungeon" && toMapId === "dungeon") {
      resetDungeonEnemyDefeats();
    }
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
    return this.enemyObjectAt(position)?.enemy;
  }

  private enemyObjectAt(position: TilePosition, ignoredEnemyId?: string): EnemyVisual | undefined {
    for (const enemyObject of this.enemyObjects.values()) {
      if (
        enemyObject.enemy.id !== ignoredEnemyId &&
        enemyObject.tile.x === position.x &&
        enemyObject.tile.y === position.y &&
        !getSave().defeatedEnemies.includes(enemyObject.enemy.id)
      ) {
        return enemyObject;
      }
    }

    return undefined;
  }

  private canEnemyOccupy(position: TilePosition, enemyId: string): boolean {
    if (this.isTerrainBlocked(position)) {
      return false;
    }

    if (position.x === this.playerTile.x && position.y === this.playerTile.y) {
      return false;
    }

    if (this.currentMap.portals.some((portal) => portal.x === position.x && portal.y === position.y)) {
      return false;
    }

    return !(
      this.npcAt(position) ||
      this.chestAt(position) ||
      this.enemyObjectAt(position, enemyId)
    );
  }

  private isEnemyWeakerThanPlayer(enemy: EnemySpawn): boolean {
    const definition = ENEMIES[enemy.enemyKey];
    if (!definition?.maxHp || definition.boss) {
      return false;
    }

    const save = getSave();
    const playerPower = getPlayerMaxHp() + getPlayerAttack() * 4 + save.level * 2;
    const enemyPower = definition.maxHp + definition.attack * 4;
    return enemyPower <= playerPower * ENEMY_WEAKNESS_RATIO;
  }

  private offsetPosition(position: TilePosition, direction: Direction): TilePosition {
    const vector = directionVectors[direction];
    return {
      x: position.x + vector.x,
      y: position.y + vector.y
    };
  }

  private getDirectionBetween(from: TilePosition, to: TilePosition): Direction | undefined {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    if (deltaX === 1) {
      return "right";
    }
    if (deltaX === -1) {
      return "left";
    }
    if (deltaY === 1) {
      return "down";
    }
    if (deltaY === -1) {
      return "up";
    }
    return undefined;
  }

  private alignCharacterSprite(
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string
  ): Phaser.GameObjects.Sprite {
    return sprite.setOrigin(0.5, getCharacterOriginY(textureKey));
  }

  private playCharacterIdle(
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string,
    direction: Direction = "down"
  ): void {
    this.playCharacterAnimation(sprite, getCharacterIdleAnimationKey(textureKey, direction));
  }

  private playCharacterWalk(
    sprite: Phaser.GameObjects.Sprite,
    textureKey: string,
    direction: Direction
  ): void {
    this.playCharacterAnimation(sprite, getCharacterWalkAnimationKey(textureKey, direction));
  }

  private playCharacterAnimation(sprite: Phaser.GameObjects.Sprite, animationKey: string): void {
    if (!this.anims.exists(animationKey)) {
      return;
    }

    sprite.play(animationKey, true);
  }

  private distance(a: TilePosition, b: TilePosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private hashId(id: string): number {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
      hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  private getActiveNpcs(): NpcDefinition[] {
    return this.currentMap.npcs.filter(
      (npc) =>
        (!npc.requiresFlag || hasFlag(npc.requiresFlag)) &&
        (!npc.hiddenIfFlag || !hasFlag(npc.hiddenIfFlag))
    );
  }

  private npcAt(position: TilePosition): NpcDefinition | undefined {
    return this.getActiveNpcs().find((npc) => npc.x === position.x && npc.y === position.y);
  }

  private chestAt(position: TilePosition): ChestDefinition | undefined {
    return this.currentMap.chests.find((chest) => chest.x === position.x && chest.y === position.y);
  }

  private portalAt(position: TilePosition) {
    return this.currentMap.portals.find((portal) => portal.x === position.x && portal.y === position.y);
  }

  private frontTile(): TilePosition {
    const vector = directionVectors[this.facing];
    return {
      x: this.playerTile.x + vector.x,
      y: this.playerTile.y + vector.y
    };
  }

  private showDialogue(lines: string[]): void {
    this.hideTargetHint();
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
      this.refreshTargetHint();
      return;
    }

    this.dialogueText?.setText(this.dialogueLines[this.dialogueIndex]);
  }

  private createDialoguePanel(): void {
    this.dialogueBox = this.add
      .rectangle(400, 535, 688, 92, 0x101722, 0.97)
      .setStrokeStyle(2, 0xd6b56a, 0.95)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false);
    this.dialogueAccent = this.add
      .rectangle(400, 493, 650, 2, 0xf0d98a, 0.8)
      .setScrollFactor(0)
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
      .setScrollFactor(0)
      .setDepth(41)
      .setVisible(false);
  }

  private createTargetHintPanel(): void {
    this.targetHintBox = this.add
      .rectangle(0, 0, 164, 42, 0x0e1720, 0.94)
      .setStrokeStyle(1, 0xf0d98a, 0.86)
      .setDepth(34)
      .setVisible(false);
    this.targetHintText = this.add
      .text(0, 0, "", {
        fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
        fontSize: "14px",
        color: "#fff4cf",
        align: "center",
        wordWrap: { width: 148, useAdvancedWrap: true },
        lineSpacing: 3
      })
      .setOrigin(0.5, 0.5)
      .setDepth(35)
      .setVisible(false);
  }

  private refreshTargetHint(): void {
    if (this.loadingMap || this.menuOpen || this.dialogueLines.length > 0 || this.moving) {
      this.hideTargetHint();
      return;
    }

    const hint = this.getTargetHint();
    if (!hint) {
      this.hideTargetHint();
      return;
    }

    const lineCount = hint.text.split("\n").length;
    const height = lineCount > 1 ? 48 : 34;
    const width = 164;
    const mapPixelWidth = this.currentMap.rows[0].length * TILE_SIZE;
    const mapPixelHeight = this.currentMap.rows.length * TILE_SIZE;
    const x = Phaser.Math.Clamp(this.toWorldX(hint.position.x), width / 2, mapPixelWidth - width / 2);
    const y = Phaser.Math.Clamp(
      this.toWorldY(hint.position.y) - 34,
      height / 2,
      mapPixelHeight - height / 2
    );

    this.targetHintText?.setText(hint.text);
    this.targetHintBox?.setPosition(x, y).setDisplaySize(width, height).setVisible(true);
    this.targetHintText?.setPosition(x, y).setVisible(true);
  }

  private hideTargetHint(): void {
    this.targetHintBox?.setVisible(false);
    this.targetHintText?.setVisible(false);
  }

  private getTargetHint(): { text: string; position: TilePosition } | undefined {
    const front = this.describeTargetAt(this.frontTile());
    if (front) {
      return front;
    }

    const adjacentDirections: Direction[] = ["up", "right", "down", "left"];
    for (const direction of adjacentDirections) {
      const hint = this.describeTargetAt(this.offsetPosition(this.playerTile, direction));
      if (hint) {
        return hint;
      }
    }

    return undefined;
  }

  private describeTargetAt(position: TilePosition): { text: string; position: TilePosition } | undefined {
    const npc = this.npcAt(position);
    if (npc) {
      return { text: this.describeNpc(npc), position };
    }

    const chest = this.chestAt(position);
    if (chest) {
      return {
        text: hasFlag(`${chest.id}-opened`) ? "空の宝箱" : "宝箱\n開く",
        position
      };
    }

    const enemy = this.enemyAt(position);
    if (enemy) {
      const definition = ENEMIES[enemy.enemyKey];
      return {
        text: definition ? `${definition.name}\nHP${definition.maxHp} 攻${definition.attack}` : "魔物",
        position
      };
    }

    const portal = this.portalAt(position);
    if (portal) {
      return { text: this.describePortal(portal.kind), position };
    }

    return undefined;
  }

  private describeNpc(npc: NpcDefinition): string {
    if (npc.id === "shopkeeper" || npc.id === "equipmentShopkeeper") {
      return `${npc.name}\n売買`;
    }
    if (npc.id === "healer") {
      return `${npc.name}\n回復`;
    }
    return npc.name;
  }

  private describePortal(kind: string | undefined): string {
    if (kind === "stairs-up") {
      return "階段上\n移動";
    }
    if (kind === "stairs-down") {
      return "階段下\n移動";
    }
    return "入口\n移動";
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
    return map.chests.some(
      (chest) => chest.reward?.type === "item" || chest.reward?.type === "equipment"
    );
  }
}
