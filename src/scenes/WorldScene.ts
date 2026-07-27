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
import {
  getDungeonNameForTier,
  getFieldDungeonEntranceForTier,
  getGuardianIdForTier
} from "../data/dungeonGenerator";
import { createDungeon } from "../data/dungeonService";
import {
  dungeonTileFrame,
  overworldGroundUnderObjectFrame,
  overworldTileFrame,
  TERRAIN_OVERWORLD_KEY
} from "../game/autotile";
import { ENEMIES } from "../data/enemies";
import { EQUIPMENT, MASTERWORK_EQUIPMENT_ORDER } from "../data/equipment";
import { ITEMS } from "../data/items";
import { BLOCKING_TILES, getMapDefinition, MAPS } from "../data/maps";
import {
  GAME_EVENTS,
  HUD_BOTTOM_HEIGHT,
  HUD_TOP_HEIGHT,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  TILE_SIZE
} from "../game/constants";
import {
  addItem,
  addEquipment,
  ensureDungeonProgress,
  getActiveDungeonTier,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getGeneratedDungeonFloor,
  getItemCount,
  getPlayerAttack,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion,
  hasFlag,
  healCompanion,
  healPlayer,
  isEnemyDefeated,
  isExpandedWorldUnlocked,
  markFlag,
  persistSave,
  recruitCompanion,
  resetSave,
  resetDungeonEnemyDefeats,
  resetFieldEnemyDefeats,
  restoreCompanionMp,
  restorePlayerMp,
  setActiveDungeonTier,
  setCurrentDungeonFloor,
  setGeneratedDungeonFloor,
  setPlayerPosition
} from "../game/GameState";
import { COMPANION_ORDER, COMPANIONS } from "../data/companions";
import type { CompanionId } from "../data/companions";
import type {
  ChestDefinition,
  Direction,
  EnemySpawn,
  EquipmentId,
  MapDefinition,
  MapId,
  NpcDefinition,
  PortalDefinition,
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
  /** One follower per recruited companion, in COMPANION_ORDER's party-line order (player -> allyFollowers[0] -> allyFollowers[1] -> ...). */
  private allyFollowers = new Map<
    CompanionId,
    { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse; tile: TilePosition }
  >();
  private facing: Direction = "down";
  private moving = false;
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private dialogueOnComplete?: () => void;
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
    void this.loadMap(save.mapId, { x: save.x, y: save.y }).then(() => {
      this.checkFinalBossDefeat();
    });
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
      this.setupAllyFollowers(entryTile);
      this.createDialoguePanel();
      this.createTargetHintPanel();
      this.setupCamera();
      setPlayerPosition(mapId, entryTile.x, entryTile.y);
      this.game.events.emit(GAME_EVENTS.mapChanged, this.currentMap.name, this.currentMap);
      this.game.events.emit(GAME_EVENTS.playerMoved, { ...this.playerTile });
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
    camera.setBounds(
      0,
      -HUD_TOP_HEIGHT,
      mapPixelWidth,
      mapPixelHeight + HUD_TOP_HEIGHT + HUD_BOTTOM_HEIGHT
    );
    camera.startFollow(this.player, true, 1, 1);
  }

  /**
   * Rebuilds one follower sprite per recruited companion. Depth/party-order
   * both follow COMPANION_ORDER, so a newly added companion just needs an
   * entry in data/companions.ts to get a follower slot here.
   */
  private setupAllyFollowers(entryTile: TilePosition): void {
    this.allyFollowers.clear();

    COMPANION_ORDER.forEach((id, index) => {
      if (!hasCompanion(id)) {
        return;
      }

      const texture = COMPANIONS[id].texture;
      const depth = 18 - index * 0.5;
      const shadow = this.add
        .ellipse(this.toWorldX(entryTile.x), this.toWorldY(entryTile.y) + 13, 20, 6, 0x05080b, 0.3)
        .setDepth(depth);
      const sprite = this.add.sprite(this.toWorldX(entryTile.x), this.toWorldY(entryTile.y), texture, 0);
      this.alignCharacterSprite(sprite, texture).setDepth(depth + 0.5);
      this.playCharacterIdle(sprite, texture, this.facing);
      this.allyFollowers.set(id, { sprite, shadow, tile: { ...entryTile } });
    });
  }

  private moveAllyFollower(id: CompanionId, target: TilePosition): void {
    const follower = this.allyFollowers.get(id);
    if (!follower) {
      return;
    }

    if (follower.tile.x === target.x && follower.tile.y === target.y) {
      return;
    }

    const texture = COMPANIONS[id].texture;
    const direction = this.getDirectionBetween(follower.tile, target);
    follower.tile = target;
    if (direction) {
      this.playCharacterWalk(follower.sprite, texture, direction);
    }
    this.tweens.add({
      targets: follower.sprite,
      x: this.toWorldX(target.x),
      y: this.toWorldY(target.y),
      duration: 125,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.playCharacterIdle(follower.sprite, texture, direction ?? "down");
      }
    });
    this.tweens.add({
      targets: follower.shadow,
      x: this.toWorldX(target.x),
      y: this.toWorldY(target.y) + 13,
      duration: 125,
      ease: "Sine.easeInOut"
    });
  }

  private async resolveMap(mapId: MapId): Promise<MapDefinition> {
    if (mapId !== "dungeon") {
      return getMapDefinition(mapId, isExpandedWorldUnlocked());
    }

    const dungeonTier = getActiveDungeonTier();
    const { floorCount, currentFloor } = ensureDungeonProgress(dungeonTier);
    const generatedDungeon = getGeneratedDungeonFloor(currentFloor, dungeonTier);
    if (generatedDungeon && this.hasSupplyChest(generatedDungeon)) {
      return { ...generatedDungeon, tier: dungeonTier };
    }

    const previousFloor =
      currentFloor > 1 ? getGeneratedDungeonFloor(currentFloor - 1, dungeonTier) : undefined;
    const previousDownStairs = previousFloor?.portals.find(
      (portal) => portal.kind === "stairs-down" && portal.toFloor === currentFloor
    );
    const upTarget = previousDownStairs
      ? { x: previousDownStairs.x, y: previousDownStairs.y }
      : undefined;

    this.game.events.emit(GAME_EVENTS.toast, `B${currentFloor}Fを生成中...`);
    const { dungeon, source } = await createDungeon(currentFloor, floorCount, upTarget, dungeonTier);
    setGeneratedDungeonFloor(currentFloor, dungeon, dungeonTier);
    this.game.events.emit(
      GAME_EVENTS.toast,
      source === "groq"
        ? `AIがB${currentFloor}Fを描き替えた`
        : `B${currentFloor}Fの地形が変化した`
    );
    return { ...dungeon, tier: dungeonTier };
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
        const worldX = MAP_OFFSET_X + x * TILE_SIZE;
        const worldY = MAP_OFFSET_Y + y * TILE_SIZE;
        const { ground, object } = this.getTileLayers(tile, x, y);
        this.add.image(worldX, worldY, ground.key, ground.frame).setOrigin(0).setDepth(0);
        if (object) {
          this.add.image(worldX, worldY, object.key, object.frame).setOrigin(0).setDepth(1);
        }
      }
    }
  }

  private createObjects(): void {
    this.enemyObjects.clear();
    this.getActivePortals().forEach((portal) => {
      if (portal.kind === "edge") {
        // Edge portals sit on a border tile that's meant to read as open
        // terrain leading off the map, not a marked door — no icon sprite.
        return;
      }
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
    void this.loadMap(this.currentMap.id, this.playerTile).then(() => {
      this.checkFinalBossDefeat();
      this.checkMistSovereignDefeat();
    });
  }

  private checkFinalBossDefeat(): void {
    if (
      this.currentMap.id !== "dungeon" ||
      getActiveDungeonTier() !== 3 ||
      !isEnemyDefeated(getGuardianIdForTier(3)) ||
      hasFlag("finalBeastDefeated")
    ) {
      return;
    }

    markFlag("finalBeastDefeated");
    this.game.events.emit(GAME_EVENTS.stateChanged);
    void this.loadMap("field", this.getFieldDungeonEntrance()).then(() => {
      this.showDialogue([
        "月蝕の魔獣を討ち果たした。深い霧が晴れていくのがわかる。",
        "ルナ: ……終わった、のですね。",
        "村長ローアンに報告しに行きましょう。"
      ]);
    });
  }

  private checkMistSovereignDefeat(): void {
    if (
      this.currentMap.id !== "dungeon" ||
      getActiveDungeonTier() !== 4 ||
      !isEnemyDefeated(getGuardianIdForTier(4)) ||
      hasFlag("mistSovereignDefeated")
    ) {
      return;
    }

    markFlag("mistSovereignDefeated");
    this.game.events.emit(GAME_EVENTS.stateChanged);
    void this.loadMap("field", this.getFieldDungeonEntrance()).then(() => {
      this.showDialogue([
        "深霧の魔王は霧となって消え去った。",
        "ルナ: ここにも、まだ知られざる脅威が眠っていたのですね。",
        "霧隠れの里の長老に、報告に行きましょう。"
      ]);
    });
  }

  private launchEnding(): void {
    this.scene.launch("EndingScene");
    this.scene.pause();
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

    const edgePortal = this.edgePortalAt(target);
    if (edgePortal) {
      this.hideTargetHint();
      void this.traversePortal(edgePortal);
      return;
    }

    if (this.isBlocked(target)) {
      this.refreshTargetHint();
      return;
    }

    const previousPlayerTile = { ...this.playerTile };
    this.moving = true;
    this.hideTargetHint();
    this.playerTile = target;
    this.playCharacterWalk(this.player, "player", direction);
    setPlayerPosition(this.currentMap.id, target.x, target.y);
    this.game.events.emit(GAME_EVENTS.playerMoved, { ...target });
    // Each ally trails whoever is directly ahead of it in COMPANION_ORDER
    // (the first trails the player), so the party lines up single-file:
    // player -> ally[0] -> ally[1] -> ...
    let previousTile = previousPlayerTile;
    COMPANION_ORDER.forEach((id) => {
      const follower = this.allyFollowers.get(id);
      if (!follower) {
        return;
      }
      const ownPreviousTile = { ...follower.tile };
      this.moveAllyFollower(id, previousTile);
      previousTile = ownPreviousTile;
    });
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

      if (
        this.shouldEnemyChase(enemyObject) &&
        this.distance(enemyObject.tile, this.playerTile) <= 1
      ) {
        this.startBattle(enemyObject.enemy);
        return;
      }

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

    if (this.shouldEnemyChase(enemyObject)) {
      return this.chooseChaseTile(enemyObject);
    }

    return this.choosePatrolTile(enemyObject);
  }

  private shouldEnemyFlee(enemyObject: EnemyVisual): boolean {
    return (
      this.distance(enemyObject.tile, this.playerTile) <= ENEMY_AWARENESS_RANGE &&
      this.isEnemyWeakerThanPlayer(enemyObject.enemy)
    );
  }

  private shouldEnemyChase(enemyObject: EnemyVisual): boolean {
    return (
      this.currentMap.id === "dungeon" &&
      this.distance(enemyObject.tile, this.playerTile) <= ENEMY_AWARENESS_RANGE &&
      !this.isEnemyWeakerThanPlayer(enemyObject.enemy)
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

  private chooseChaseTile(enemyObject: EnemyVisual): TilePosition | undefined {
    const currentDistance = this.distance(enemyObject.tile, this.playerTile);
    const options = this.getEnemyMoveOptions(enemyObject)
      .map((position) => ({
        position,
        distance: this.distance(position, this.playerTile)
      }))
      .filter((option) => option.distance < currentDistance)
      .sort((a, b) => a.distance - b.distance);

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
    // Keep the underlying spawn record in sync so a same-map reload (e.g.
    // opening a chest, or returning from battle) rebuilds enemies at their
    // current patrol position instead of snapping them back to spawn.
    enemyObject.enemy.x = tile.x;
    enemyObject.enemy.y = tile.y;
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

    if (!hasCompanion("luna")) {
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

    if (npc.id === "masterworkShopkeeper") {
      this.openShop("equipment", MASTERWORK_EQUIPMENT_ORDER);
      return;
    }

    let dialogue: string[] | undefined;
    let stateChanged = false;
    let shouldReloadMap = false;
    let onDialogueComplete: (() => void) | undefined;

    if (npc.id === "healer") {
      const firstHerbGift = !hasFlag("healerHerbGiven");
      if (firstHerbGift) {
        addItem("herb", 1);
        markFlag("healerHerbGiven");
      }
      if (getItemCount("manaWater") < 2) {
        addItem("manaWater", 1);
      }
      healPlayer(getPlayerMaxHp());
      restorePlayerMp(getPlayerMaxMp());
      COMPANION_ORDER.forEach((id) => {
        if (hasCompanion(id)) {
          healCompanion(id, getCompanionMaxHp(id));
          restoreCompanionMp(id, getCompanionMaxMp(id));
        }
      });
      stateChanged = true;
      dialogue = firstHerbGift
        ? ["ミラ: 傷を癒しましょう。", "ミラ: 予備の薬草も荷物に入れておきました。"]
        : ["ミラ: 傷を癒しましょう。"];
    }

    if (npc.id === "luna") {
      recruitCompanion("luna");
      stateChanged = true;
      shouldReloadMap = true;
      dialogue = [
        "ルナ: 太陽石を取り戻したのですね。",
        "ルナ: でも、次の月影石は深い洞窟の奥。一人で挑むには荷が重いはず。",
        "ルナ: 私が手助けしましょう。仲間に加えてください。",
        "ルナが仲間になった！"
      ];
    }

    if (npc.id === "geist") {
      recruitCompanion("geist");
      stateChanged = true;
      shouldReloadMap = true;
      dialogue = [
        "ガイスト……この鎧に、まだ意志が残っていたのか。",
        "ガイスト: ……長い、眠りだった。深霧の魔王を倒すというのなら、力を貸そう。",
        "ガイストが仲間になった！"
      ];
    }

    if (npc.id === "elder") {
      if (!hasFlag("questAccepted")) {
        const save = getSave();
        save.gold += 10;
        markFlag("questAccepted");
        persistSave();
        stateChanged = true;
        dialogue = [
          "村長ローアン: エンバーフォール洞窟には、太陽石という古い秘宝が眠っている。",
          "村長ローアン: ストーンブルックのために、取り戻してくれるか？",
          "村長ローアン: 手付けに、これを持っていっておくれ。",
          "金貨10枚を受け取った。",
          "クエスト開始: 太陽石を探す"
        ];
      } else if (hasFlag("treasureFound") && !hasFlag("questComplete")) {
        const save = getSave();
        save.gold += 40;
        markFlag("questComplete");
        markFlag("secondQuestAccepted");
        resetDungeonEnemyDefeats();
        resetFieldEnemyDefeats();
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
        markFlag("thirdQuestAccepted");
        resetDungeonEnemyDefeats();
        resetFieldEnemyDefeats();
        persistSave();
        stateChanged = true;
        dialogue = [
          "村長ローアン: 月影石まで持ち帰ってくれたのか。",
          "金貨120枚を受け取った。",
          "太陽石と月影石が呼応し、村を包む結界が強く輝いた。",
          "村長ローアン: だが……その輝きに応えるように、草原の奥に新たな坑道が口を開けた。",
          "村長ローアン: 中には禍々しい月蝕の魔獣が眠っているという。この地を脅かす前に、討ち果たしてきてくれないか。",
          "クエスト開始: 月蝕の魔獣を討伐する"
        ];
      } else if (hasFlag("questComplete") && !hasFlag("secondQuestAccepted")) {
        markFlag("secondQuestAccepted");
        stateChanged = true;
        dialogue = getNpcDialogue(npc.id);
      } else if (hasFlag("finalBeastDefeated") && !hasFlag("thirdQuestComplete")) {
        const save = getSave();
        save.gold += 200;
        markFlag("thirdQuestComplete");
        persistSave();
        stateChanged = true;
        onDialogueComplete = () => this.launchEnding();
        dialogue = [
          "村長ローアン: 月蝕の魔獣を討ち果たしてくれたのか……!",
          "金貨200枚を受け取った。",
          "村長ローアン: おぬしのおかげで、この谷に静けさが戻った。だが……まだ何かが終わった気はしない。",
          "ルナ: 私も同じことを感じています。谷の外れに、深い霧に包まれた里があるとか。",
          "ルナ: きっと、私たちの冒険は、まだ始まったばかりなのですね。"
        ];
      }
    }

    if (npc.id === "hiddenElder") {
      if (!hasFlag("fourthQuestAccepted")) {
        const save = getSave();
        save.gold += 20;
        markFlag("fourthQuestAccepted");
        persistSave();
        stateChanged = true;
        dialogue = [
          "隠れ里の長老: よくぞ霧を越えて参られた。この里は深霧の魔王の気配に、長く怯えて暮らしてきた。",
          "隠れ里の長老: 里の奥に開いた坑道に、その魔王が眠っている。討ち果たしてはくれぬか。",
          "隠れ里の長老: 手付けに、これを持っていっておくれ。",
          "金貨20枚を受け取った。",
          "クエスト開始: 深霧の魔王を討伐する"
        ];
      } else if (hasFlag("mistSovereignDefeated") && !hasFlag("fourthQuestComplete")) {
        const save = getSave();
        save.gold += 300;
        markFlag("fourthQuestComplete");
        persistSave();
        stateChanged = true;
        dialogue = [
          "隠れ里の長老: 深霧の魔王を討ち果たしてくれたのか……!",
          "金貨300枚を受け取った。",
          "隠れ里の長老: これで、里に平穏が戻る。おぬしには、いくら感謝してもし足りぬ。"
        ];
      }
    }

    if (stateChanged) {
      this.game.events.emit(GAME_EVENTS.stateChanged);
    }

    if (shouldReloadMap) {
      await this.loadMap(this.currentMap.id, this.playerTile);
    }

    this.showDialogue(dialogue ?? getNpcDialogue(npc.id), onDialogueComplete);
  }

  private async openChest(chest: ChestDefinition): Promise<void> {
    if (hasFlag(`${chest.id}-opened`)) {
      this.showDialogue(["宝箱は空だ。"]);
      return;
    }

    const isRelicChest = chest.reward?.type === "relic" || chest.id === "relic-chest";
    const dungeonTier = getActiveDungeonTier();
    if (isRelicChest && !getSave().defeatedEnemies.includes(getGuardianIdForTier(dungeonTier))) {
      this.showDialogue(["守護者の紋章が刻まれた封印で開かない。"]);
      return;
    }

    markFlag(`${chest.id}-opened`);
    if (isRelicChest) {
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
      enemyKeys: this.buildEncounterGroup(enemy)
    });
    this.scene.pause();
  }

  /**
   * From dungeon tier 3 onward, a non-boss encounter can pull in 1-3 of the
   * same enemy at once. Bosses (guardians) always fight alone, and field
   * encounters are never grouped.
   */
  private buildEncounterGroup(enemy: EnemySpawn): string[] {
    const definition = ENEMIES[enemy.enemyKey];
    const isGroupableDungeonFloor = this.currentMap.id === "dungeon" && (this.currentMap.tier ?? 1) >= 3;
    if (!isGroupableDungeonFloor || definition?.boss) {
      return [enemy.enemyKey];
    }

    const count = Phaser.Math.Between(1, 3);
    return Array.from({ length: count }, () => enemy.enemyKey);
  }

  private canOpenMenu(): boolean {
    return !this.loadingMap && !this.menuOpen && this.dialogueLines.length === 0 && !this.moving;
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.hideTargetHint();
    this.scene.launch("MenuScene");
  }

  private openShop(shopKind: ShopKind, buyableEquipmentIds?: EquipmentId[]): void {
    this.menuOpen = true;
    this.hideTargetHint();
    this.scene.launch("ShopScene", { shopKind, buyableEquipmentIds });
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

  private getFieldDungeonEntrance(tier = getActiveDungeonTier()): TilePosition {
    return { ...getFieldDungeonEntranceForTier(tier) };
  }

  private async checkPortal(): Promise<void> {
    const portal = this.getActivePortals().find(
      (candidate) =>
        candidate.kind !== "edge" &&
        candidate.x === this.playerTile.x &&
        candidate.y === this.playerTile.y
    );

    if (!portal) {
      return;
    }

    await this.traversePortal(portal);
  }

  private async traversePortal(portal: PortalDefinition): Promise<void> {
    this.applyRespawnRules(this.currentMap.id, portal.toMap);

    if (portal.toMap === "dungeon") {
      const tier = portal.dungeonTier ?? getActiveDungeonTier();
      setActiveDungeonTier(tier);
      ensureDungeonProgress(tier);
      setCurrentDungeonFloor(portal.toFloor ?? 1, tier);
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

    if (this.getActivePortals().some((portal) => portal.x === position.x && portal.y === position.y)) {
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

  private getActivePortals(): PortalDefinition[] {
    return this.currentMap.portals.filter(
      (portal) => !portal.requiresFlag || hasFlag(portal.requiresFlag)
    );
  }

  private portalAt(position: TilePosition) {
    return this.getActivePortals().find((portal) => portal.x === position.x && portal.y === position.y);
  }

  private edgePortalAt(position: TilePosition): PortalDefinition | undefined {
    return this.getActivePortals().find(
      (portal) => portal.kind === "edge" && portal.x === position.x && portal.y === position.y
    );
  }

  private frontTile(): TilePosition {
    const vector = directionVectors[this.facing];
    return {
      x: this.playerTile.x + vector.x,
      y: this.playerTile.y + vector.y
    };
  }

  private showDialogue(lines: string[], onComplete?: () => void): void {
    this.hideTargetHint();
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueOnComplete = onComplete;
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
      const onComplete = this.dialogueOnComplete;
      this.dialogueOnComplete = undefined;
      onComplete?.();
      return;
    }

    this.dialogueText?.setText(this.dialogueLines[this.dialogueIndex]);
  }

  private createDialoguePanel(): void {
    this.dialogueBox = this.add
      .rectangle(400, 472, 688, 92, 0x101722, 0.97)
      .setStrokeStyle(2, 0xd6b56a, 0.95)
      .setScrollFactor(0)
      .setDepth(40)
      .setVisible(false);
    this.dialogueAccent = this.add
      .rectangle(400, 430, 650, 2, 0xf0d98a, 0.8)
      .setScrollFactor(0)
      .setDepth(41)
      .setVisible(false);
    this.dialogueText = this.add
      .text(96, 441, "", {
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
      return { text: this.describePortal(portal), position };
    }

    return undefined;
  }

  private describeNpc(npc: NpcDefinition): string {
    if (
      npc.id === "shopkeeper" ||
      npc.id === "equipmentShopkeeper" ||
      npc.id === "masterworkShopkeeper"
    ) {
      return `${npc.name}\n売買`;
    }
    if (npc.id === "healer") {
      return `${npc.name}\n回復`;
    }
    return npc.name;
  }

  private describePortal(portal: PortalDefinition): string {
    if (portal.kind === "stairs-up") {
      return "階段上\n移動";
    }
    if (portal.kind === "stairs-down") {
      return "階段下\n移動";
    }
    if (portal.toMap === "dungeon" && portal.dungeonTier !== undefined) {
      return `${getDungeonNameForTier(portal.dungeonTier)}\n入る`;
    }
    return "入口\n移動";
  }

  private getTileLayers(
    tile: string,
    x: number,
    y: number
  ): { ground: { key: string; frame: number }; object?: { key: string; frame: number } } {
    const isDungeon = this.currentMap.id === "dungeon";

    if (isDungeon) {
      // '#' is a genuine wall in dungeons, but overworld-only object tiles
      // (house/tree/rock) never appear here, so every other char blends as
      // wall/floor/water ground.
      if (tile === "H" || tile === "^" || tile === "C") {
        return { ground: { key: "tile-rock", frame: 0 } };
      }
      const dungeonTier = this.currentMap.tier ?? 1;
      return { ground: dungeonTileFrame(this.currentMap.rows, x, y, dungeonTier) };
    }

    // Trees/rocks are drawn as a small silhouette over a real blended-grass
    // ground tile (see BootScene.createObjectTile), so the map doesn't read
    // as a solid colored square wherever an object sits. Houses stay a
    // single opaque tile — a building legitimately fills its whole footprint.
    switch (tile) {
      case "H":
        return { ground: { key: "tile-house", frame: 0 } };
      case "#":
        return {
          ground: { key: TERRAIN_OVERWORLD_KEY, frame: overworldGroundUnderObjectFrame(this.currentMap.rows, x, y) },
          object: { key: "tile-tree", frame: 0 }
        };
      case "^":
      case "C":
        return {
          ground: { key: TERRAIN_OVERWORLD_KEY, frame: overworldGroundUnderObjectFrame(this.currentMap.rows, x, y) },
          object: { key: "tile-rock", frame: 0 }
        };
      default: {
        const frame = overworldTileFrame(this.currentMap.rows, x, y);
        return { ground: { key: TERRAIN_OVERWORLD_KEY, frame: frame ?? 0 } };
      }
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
