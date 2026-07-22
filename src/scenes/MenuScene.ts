import Phaser from "phaser";
import { getCharacterIdleAnimationKey } from "../data/characterSprites";
import {
  EQUIPMENT,
  EQUIPMENT_ORDER,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  getEquipmentRarityLabel,
  getEquipmentStatSummary
} from "../data/equipment";
import { fetchLunaLine, getCurrentLunaStage, getLunaLine, getNextStaticLunaLine } from "../data/dialogues";
import {
  canItemEscapeDungeon,
  canItemHealHp,
  canItemRestoreMp,
  getItemRarityLabel,
  ITEM_ORDER,
  ITEMS
} from "../data/items";
import { getDungeonNameForTier } from "../data/dungeonGenerator";
import { getMapDefinition } from "../data/maps";
import { getSkillHealAmount, SKILL_ORDER, SKILLS } from "../data/skills";
import { GAME_EVENTS } from "../game/constants";
import {
  getActiveDungeonTier,
  getCompanionHp,
  getCompanionMaxHp,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  getEquipmentCount,
  getEquippedEquipment,
  getItemCount,
  getPlayerAttack,
  getPlayerDefense,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion,
  isExpandedWorldUnlocked,
  consumeItem,
  equipEquipment,
  useHealingSkill,
  useHealingSkillOnCompanion,
  useItem
} from "../game/GameState";
import type { EquipmentId, ItemId } from "../game/types";

type MenuTab = "items" | "skills" | "equipment" | "status" | "companion";

const BASE_TABS: MenuTab[] = ["items", "skills", "equipment", "status"];
const TAB_LABELS: Record<MenuTab, string> = {
  items: "持ち物",
  skills: "スキル",
  equipment: "装備",
  status: "強さ",
  companion: "ルナ"
};

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = "items";
  private selectedItemIndex = 0;
  private selectedSkillIndex = 0;
  private selectedEquipmentIndex = 0;
  private tabButtons: Partial<Record<MenuTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private messageText?: Phaser.GameObjects.Text;
  private lunaLine = "";
  private lunaLoading = false;
  private lunaRequestToken = 0;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.activeTab = "items";
    this.selectedItemIndex = 0;
    this.selectedSkillIndex = 0;
    this.selectedEquipmentIndex = 0;
    this.contentObjects = [];
    this.tabButtons = {};
    this.lunaLine = "";
    this.lunaLoading = false;
    this.lunaRequestToken = 0;

    this.add.rectangle(400, 320, 800, 640, 0x05080b, 0.58).setDepth(90);
    this.add
      .rectangle(400, 320, 560, 424, 0x101923, 0.98)
      .setStrokeStyle(3, 0xd8bc72)
      .setDepth(100);
    this.add.rectangle(400, 154, 508, 2, 0xf0d98a, 0.75).setDepth(101);
    this.add.text(154, 120, "メニュー", this.textStyle(25, "#f6e4a4")).setDepth(102);

    const visibleTabs = this.getVisibleTabs();
    const tabWidth = visibleTabs.length > 4 ? 88 : 96;
    const tabSpacing = visibleTabs.length > 4 ? 100 : 112;
    visibleTabs.forEach((tab, index) => {
      this.createTabButton(tab, 154 + index * tabSpacing, 176, tabWidth);
    });
    this.createCloseButton();
    this.messageText = this.add
      .text(154, 492, "", this.textStyle(16, "#f6e4a4"))
      .setDepth(102);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once("shutdown", this.cleanup, this);
    this.renderContent();
  }

  private getVisibleTabs(): MenuTab[] {
    return hasCompanion() ? [...BASE_TABS, "companion"] : BASE_TABS;
  }

  private createTabButton(tab: MenuTab, x: number, y: number, width: number): void {
    const button = this.add
      .text(x, y, TAB_LABELS[tab], {
        ...this.textStyle(width < 96 ? 16 : 18, "#101820"),
        backgroundColor: "#f2d27a",
        padding: { x: width < 96 ? 12 : 18, y: 9 },
        fixedWidth: width,
        align: "center"
      })
      .setDepth(102)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.selectTab(tab));
    this.tabButtons[tab] = button;
  }

  private createCloseButton(): void {
    this.add
      .text(564, 120, "閉じる", {
        ...this.textStyle(17, "#101820"),
        backgroundColor: "#d8bc72",
        padding: { x: 18, y: 9 },
        fixedWidth: 96,
        align: "center"
      })
      .setDepth(102)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.closeMenu());
  }

  private selectTab(tab: MenuTab): void {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    this.setMessage("");
    this.renderContent();
  }

  private renderContent(): void {
    this.clearContent();
    this.updateTabs();

    if (this.activeTab === "items") {
      this.renderItems();
      return;
    }

    if (this.activeTab === "skills") {
      this.renderSkills();
      return;
    }

    if (this.activeTab === "equipment") {
      this.renderEquipment();
      return;
    }

    if (this.activeTab === "companion") {
      this.renderCompanion();
      return;
    }

    this.renderStatus();
  }

  private renderItems(): void {
    const save = getSave();
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    const selectedItem = ITEM_ORDER[this.selectedItemIndex];
    const canUseSelected = this.canUseInventoryItem(selectedItem);

    ITEM_ORDER.forEach((itemId, index) => {
      const item = ITEMS[itemId];
      const selected = index === this.selectedItemIndex;
      const count = getItemCount(itemId);
      const y = 216 + index * 40;
      const row = this.add
        .rectangle(388, y + 14, 468, 36, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8bc72 : 0x34475a, selected ? 0.9 : 0.45)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.selectItem(index));
      this.addContent(row);
      this.addContent(
        this.add
          .text(164, y, selected ? ">" : "", this.textStyle(18, "#f6e4a4"))
          .setDepth(102)
      );
      this.addContent(
        this.add.text(190, y, item.name, this.textStyle(18, "#fff4cf")).setDepth(102)
      );
      this.addContent(
        this.add.text(294, y, getItemRarityLabel(itemId), this.textStyle(15, "#f4df7e")).setDepth(102)
      );
      this.addContent(
        this.add.text(340, y, `x${count}`, this.textStyle(17, "#d9e5ef")).setDepth(102)
      );
      this.addContent(
        this.add.text(404, y, item.description, this.textStyle(14, "#9fb4c6")).setDepth(102)
      );
    });

    this.addContent(
      this.add
        .text(154, 416, `現在HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
    );
    this.addContent(
      this.add.text(154, 440, `所持ゴールド ${save.gold}G`, this.textStyle(15, "#d9e5ef")).setDepth(102)
    );

    const useButton = this.add
      .text(530, 412, "使う", {
        ...this.textStyle(18, canUseSelected ? "#101820" : "#2a3036"),
        backgroundColor: canUseSelected ? "#f2d27a" : "#66707a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(canUseSelected ? 1 : 0.58)
      .setDepth(102);

    if (canUseSelected) {
      useButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useSelectedItem());
    }
    this.addContent(useButton);
  }

  private renderSkills(): void {
    const save = getSave();
    const maxHp = getPlayerMaxHp();
    const maxMp = getPlayerMaxMp();
    const selectedSkillId = SKILL_ORDER[this.selectedSkillIndex];
    const selectedSkill = SKILLS[selectedSkillId];
    const selectedLearned = save.level >= selectedSkill.requiredLevel;
    const selectedIsHeal = selectedSkill.effect.type === "heal";
    const canUseSelected =
      selectedLearned && selectedIsHeal && save.mp >= selectedSkill.mpCost && save.hp < maxHp;

    SKILL_ORDER.forEach((skillId, index) => {
      const skill = SKILLS[skillId];
      const selected = index === this.selectedSkillIndex;
      const learned = save.level >= skill.requiredLevel;
      const y = 224 + index * 48;
      const row = this.add
        .rectangle(388, y + 14, 468, 42, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8bc72 : 0x34475a, selected ? 0.9 : 0.45)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.selectSkill(index));
      this.addContent(row);
      this.addContent(
        this.add
          .text(164, y, selected ? ">" : "", this.textStyle(18, "#f6e4a4"))
          .setDepth(102)
      );
      this.addContent(
        this.add
          .text(190, y, skill.name, this.textStyle(18, learned ? "#fff4cf" : "#748393"))
          .setDepth(102)
      );
      this.addContent(
        this.add
          .text(306, y, `MP${skill.mpCost}`, this.textStyle(16, learned ? "#d9e5ef" : "#748393"))
          .setDepth(102)
      );
      this.addContent(
        this.add
          .text(
            376,
            y,
            learned ? skill.description : `Lv${skill.requiredLevel}で習得`,
            this.textStyle(14, learned ? "#9fb4c6" : "#748393")
          )
          .setDepth(102)
      );
    });

    this.addContent(
      this.add
        .text(154, 416, `現在HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
    );

    if (hasCompanion() && selectedIsHeal) {
      const canUseSelf =
        selectedLearned && save.mp >= selectedSkill.mpCost && save.hp < maxHp;
      const canUseCompanion =
        selectedLearned && save.mp >= selectedSkill.mpCost && getCompanionHp() < getCompanionMaxHp();

      this.addContent(
        this.add
          .text(
            154,
            440,
            `ルナ HP ${getCompanionHp()}/${getCompanionMaxHp()}`,
            this.textStyle(15, "#b28aff")
          )
          .setDepth(102)
      );

      const selfButton = this.add
        .text(452, 412, "自分に使う", {
          ...this.textStyle(16, canUseSelf ? "#101820" : "#2a3036"),
          backgroundColor: canUseSelf ? "#f2d27a" : "#66707a",
          padding: { x: 10, y: 10 },
          fixedWidth: 90,
          align: "center"
        })
        .setAlpha(canUseSelf ? 1 : 0.58)
        .setDepth(102);
      if (canUseSelf) {
        selfButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useSelectedSkill("self"));
      }
      this.addContent(selfButton);

      const companionButton = this.add
        .text(548, 412, "ルナに使う", {
          ...this.textStyle(16, canUseCompanion ? "#101820" : "#2a3036"),
          backgroundColor: canUseCompanion ? "#f2d27a" : "#66707a",
          padding: { x: 10, y: 10 },
          fixedWidth: 90,
          align: "center"
        })
        .setAlpha(canUseCompanion ? 1 : 0.58)
        .setDepth(102);
      if (canUseCompanion) {
        companionButton
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.useSelectedSkill("companion"));
      }
      this.addContent(companionButton);
    } else {
      const useLabel = this.getSelectedSkillUseLabel(selectedLearned, selectedIsHeal, canUseSelected);
      const useButton = this.add
        .text(518, 412, useLabel, {
          ...this.textStyle(17, canUseSelected ? "#101820" : "#2a3036"),
          backgroundColor: canUseSelected ? "#f2d27a" : "#66707a",
          padding: { x: 14, y: 10 },
          fixedWidth: 104,
          align: "center"
        })
        .setAlpha(canUseSelected ? 1 : 0.58)
        .setDepth(102);

      if (canUseSelected) {
        useButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useSelectedSkill("self"));
      }
      this.addContent(useButton);
    }

    if (selectedSkill.effect.type === "heal") {
      this.addContent(
        this.add
          .text(
            154,
            464,
            `回復量 ${getSkillHealAmount(selectedSkill, maxHp)}`,
            this.textStyle(15, "#9fb4c6")
          )
          .setDepth(102)
      );
    }
  }

  private renderEquipment(): void {
    const save = getSave();
    const ownedEquipment = this.getOwnedEquipmentIds();
    this.selectedEquipmentIndex = Phaser.Math.Clamp(
      this.selectedEquipmentIndex,
      0,
      Math.max(0, ownedEquipment.length - 1)
    );

    this.addContent(
      this.add.text(154, 214, "装備中", this.textStyle(16, "#f4df7e")).setDepth(102)
    );
    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const y = 238 + index * 24;
      const equipmentId = getEquippedEquipment(slot);
      const name = equipmentId ? EQUIPMENT[equipmentId].name : "-";
      this.addContent(
        this.add.text(154, y, EQUIPMENT_SLOT_LABELS[slot], this.textStyle(13, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(228, y, name, this.textStyle(13, equipmentId ? "#fff4cf" : "#748393")).setDepth(102)
      );
    });

    this.addContent(
      this.add.text(404, 214, "所持装備", this.textStyle(16, "#f4df7e")).setDepth(102)
    );

    if (ownedEquipment.length === 0) {
      this.addContent(
        this.add.text(404, 242, "装備品なし", this.textStyle(15, "#748393")).setDepth(102)
      );
    } else {
      const { start, visible } = this.getVisibleOwnedEquipment(ownedEquipment);
      visible.forEach((equipmentId, visibleIndex) => {
        const index = start + visibleIndex;
        const equipment = EQUIPMENT[equipmentId];
        const selected = index === this.selectedEquipmentIndex;
        const y = 238 + visibleIndex * 32;
        const row = this.add
          .rectangle(516, y + 13, 236, 30, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
          .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8bc72 : 0x34475a, selected ? 0.9 : 0.45)
          .setDepth(101)
          .setInteractive({ useHandCursor: true })
          .on("pointerdown", () => this.selectEquipment(index));
        this.addContent(row);
        this.addContent(
          this.add.text(404, y, selected ? ">" : "", this.textStyle(14, "#f6e4a4")).setDepth(102)
        );
        this.addContent(
          this.add.text(424, y, equipment.name, this.textStyle(13, "#fff4cf")).setDepth(102)
        );
        this.addContent(
          this.add.text(548, y, getEquipmentRarityLabel(equipmentId), this.textStyle(12, "#f4df7e")).setDepth(102)
        );
        this.addContent(
          this.add.text(594, y, `x${getEquipmentCount(equipmentId)}`, this.textStyle(12, "#d9e5ef")).setDepth(102)
        );
        this.addContent(
          this.add.text(424, y + 14, getEquipmentStatSummary(equipmentId), this.textStyle(11, "#9fb4c6")).setDepth(102)
        );
      });
    }

    this.addContent(
      this.add
        .text(
          154,
          416,
          `HP ${save.hp}/${getPlayerMaxHp()}  MP ${save.mp}/${getPlayerMaxMp()}  攻 ${getPlayerAttack()}  防 ${getPlayerDefense()}`,
          this.textStyle(16, "#f4df7e")
        )
        .setDepth(102)
    );

    const canEquipSelected = ownedEquipment.length > 0;
    const equipButton = this.add
      .text(530, 412, "装備", {
        ...this.textStyle(18, canEquipSelected ? "#101820" : "#2a3036"),
        backgroundColor: canEquipSelected ? "#f2d27a" : "#66707a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(canEquipSelected ? 1 : 0.58)
      .setDepth(102);

    if (canEquipSelected) {
      equipButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.equipSelectedEquipment());
    }
    this.addContent(equipButton);
  }

  private renderStatus(): void {
    const save = getSave();
    const rows = [
      ["レベル", String(save.level)],
      ["HP", `${save.hp}/${getPlayerMaxHp()}`],
      ["MP", `${save.mp}/${getPlayerMaxMp()}`],
      ["攻撃", String(getPlayerAttack())],
      ["防御", String(getPlayerDefense())],
      ["EXP", String(save.exp)],
      ["次のレベルまで", String(Math.max(0, save.level * 12 - save.exp))],
      ["ゴールド", String(save.gold)],
      ["現在地", this.currentMapName()]
    ];

    rows.forEach(([label, value], index) => {
      const y = 226 + index * 32;
      this.addContent(
        this.add.text(154, y, label, this.textStyle(17, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(342, y, value, this.textStyle(18, "#fff4cf")).setDepth(102)
      );
    });
  }

  private renderCompanion(): void {
    if (!this.lunaLine && !this.lunaLoading) {
      this.talkToLuna();
      return;
    }

    const portrait = this.add
      .sprite(214, 300, "companion-luna", 0)
      .setOrigin(0.5, 0.5)
      .setScale(2.6)
      .setDepth(102);
    const idleKey = getCharacterIdleAnimationKey("companion-luna", "down");
    if (this.anims.exists(idleKey)) {
      portrait.play(idleKey, true);
    }
    this.addContent(portrait);

    this.addContent(
      this.add.text(154, 214, "ルナ", this.textStyle(18, "#f4df7e")).setDepth(102)
    );
    this.addContent(
      this.add
        .text(316, 236, this.lunaLine || "……", {
          ...this.textStyle(16, "#fff4cf"),
          wordWrap: { width: 300, useAdvancedWrap: true },
          lineSpacing: 8
        })
        .setDepth(102)
    );

    const talkButton = this.add
      .text(530, 412, this.lunaLoading ? "……" : "話す", {
        ...this.textStyle(18, this.lunaLoading ? "#2a3036" : "#101820"),
        backgroundColor: this.lunaLoading ? "#66707a" : "#f2d27a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(this.lunaLoading ? 0.58 : 1)
      .setDepth(102);
    if (!this.lunaLoading) {
      talkButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.talkToLuna());
    }
    this.addContent(talkButton);
  }

  private talkToLuna(): void {
    if (this.lunaLoading) {
      return;
    }

    const stage = getCurrentLunaStage();

    // Static lines (first casual chats, and the one-off comment after each
    // elder milestone) always come first; only once every static line for
    // the current stage has been seen do we reach for AI generation.
    const staticLine = getNextStaticLunaLine(stage);
    if (staticLine) {
      this.lunaLine = staticLine;
      this.setMessage("");
      this.renderContent();
      return;
    }

    this.lunaLoading = true;
    this.setMessage("");
    this.renderContent();

    const requestToken = ++this.lunaRequestToken;

    fetchLunaLine(stage)
      .catch(() => getLunaLine())
      .then((line) => {
        if (requestToken !== this.lunaRequestToken || !this.scene.isActive()) {
          return;
        }

        this.lunaLine = line;
        this.lunaLoading = false;
        if (this.activeTab === "companion") {
          this.renderContent();
        }
      });
  }

  private selectItem(index: number): void {
    this.selectedItemIndex = Phaser.Math.Clamp(index, 0, ITEM_ORDER.length - 1);
    this.setMessage("");
    this.renderContent();
  }

  private selectSkill(index: number): void {
    this.selectedSkillIndex = Phaser.Math.Clamp(index, 0, SKILL_ORDER.length - 1);
    this.setMessage("");
    this.renderContent();
  }

  private selectEquipment(index: number): void {
    const ownedEquipment = this.getOwnedEquipmentIds();
    this.selectedEquipmentIndex = Phaser.Math.Clamp(index, 0, Math.max(0, ownedEquipment.length - 1));
    this.setMessage("");
    this.renderContent();
  }

  private useSelectedItem(): void {
    const itemId = ITEM_ORDER[this.selectedItemIndex];
    const item = ITEMS[itemId];
    if (getItemCount(itemId) <= 0) {
      this.setMessage(`${item.name}を持っていない。`);
      return;
    }

    if (canItemEscapeDungeon(itemId)) {
      this.useEscapeItem(itemId);
      return;
    }

    const result = useItem(itemId);
    if (!result.used) {
      this.setMessage(this.getItemFailureMessage(result.reason));
      return;
    }

    this.setMessage(this.getItemUseMessage(item.name, result.healed, result.restoredMp));
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private useEscapeItem(itemId: ItemId): void {
    const item = ITEMS[itemId];
    const save = getSave();
    if (save.mapId !== "dungeon") {
      this.setMessage("ダンジョンの中でしか使えない。");
      return;
    }

    if (!consumeItem(itemId)) {
      this.setMessage(`${item.name}を持っていない。`);
      return;
    }

    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.game.events.emit(GAME_EVENTS.escapeDungeon);
    this.closeMenu();
  }

  private equipSelectedEquipment(): void {
    const equipmentId = this.getOwnedEquipmentIds()[this.selectedEquipmentIndex];
    if (!equipmentId) {
      this.setMessage("装備品を持っていない。");
      return;
    }

    const equipment = EQUIPMENT[equipmentId];
    const result = equipEquipment(equipmentId);
    if (!result.equipped || !result.slot) {
      this.setMessage(`${equipment.name}を装備できなかった。`);
      return;
    }

    this.setMessage(`${equipment.name}を${EQUIPMENT_SLOT_LABELS[result.slot]}に装備した。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private useSelectedSkill(target: "self" | "companion" = "self"): void {
    const skillId = SKILL_ORDER[this.selectedSkillIndex];
    const skill = SKILLS[skillId];
    const save = getSave();

    if (save.level < skill.requiredLevel) {
      this.setMessage(`${skill.name}はLv${skill.requiredLevel}で覚える。`);
      return;
    }

    if (skill.effect.type !== "heal") {
      this.setMessage(`${skill.name}は戦闘中に使える技だ。`);
      return;
    }

    if (save.mp < skill.mpCost) {
      this.setMessage("MPが足りない。");
      return;
    }

    if (target === "companion") {
      if (getCompanionHp() >= getCompanionMaxHp()) {
        this.setMessage("ルナのHPは満タンだ。");
        return;
      }

      const result = useHealingSkillOnCompanion(skillId);
      if (!result.used) {
        this.setMessage(`${skill.name}を使えなかった。`);
        return;
      }

      this.setMessage(`${skill.name}でルナのHPを${result.healed}回復した。`);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.renderContent();
      return;
    }

    if (save.hp >= getPlayerMaxHp()) {
      this.setMessage("HPは満タンだ。");
      return;
    }

    const result = useHealingSkill(skillId);
    if (!result.used) {
      this.setMessage(`${skill.name}を使えなかった。`);
      return;
    }

    this.setMessage(`${skill.name}でHPを${result.healed}回復した。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape" || event.code === "KeyM") {
      this.closeMenu();
      return;
    }

    if (event.code === "ArrowLeft") {
      this.moveTab(-1);
      return;
    }

    if (event.code === "ArrowRight") {
      this.moveTab(1);
      return;
    }

    if (this.activeTab === "items" && event.code === "ArrowUp") {
      this.moveSelectedItem(-1);
      return;
    }

    if (this.activeTab === "items" && event.code === "ArrowDown") {
      this.moveSelectedItem(1);
      return;
    }

    if (this.activeTab === "skills" && event.code === "ArrowUp") {
      this.moveSelectedSkill(-1);
      return;
    }

    if (this.activeTab === "skills" && event.code === "ArrowDown") {
      this.moveSelectedSkill(1);
      return;
    }

    if (this.activeTab === "equipment" && event.code === "ArrowUp") {
      this.moveSelectedEquipment(-1);
      return;
    }

    if (this.activeTab === "equipment" && event.code === "ArrowDown") {
      this.moveSelectedEquipment(1);
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "items") {
      this.useSelectedItem();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "skills") {
      this.useSelectedSkill();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "equipment") {
      this.equipSelectedEquipment();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "companion") {
      this.talkToLuna();
    }
  }

  private moveTab(direction: number): void {
    const visibleTabs = this.getVisibleTabs();
    const currentIndex = visibleTabs.indexOf(this.activeTab);
    const nextIndex = Phaser.Math.Wrap(currentIndex + direction, 0, visibleTabs.length);
    this.selectTab(visibleTabs[nextIndex]);
  }

  private moveSelectedItem(direction: number): void {
    this.selectedItemIndex = Phaser.Math.Wrap(
      this.selectedItemIndex + direction,
      0,
      ITEM_ORDER.length
    );
    this.setMessage("");
    this.renderContent();
  }

  private moveSelectedSkill(direction: number): void {
    this.selectedSkillIndex = Phaser.Math.Wrap(
      this.selectedSkillIndex + direction,
      0,
      SKILL_ORDER.length
    );
    this.setMessage("");
    this.renderContent();
  }

  private moveSelectedEquipment(direction: number): void {
    const ownedEquipment = this.getOwnedEquipmentIds();
    if (ownedEquipment.length === 0) {
      return;
    }

    this.selectedEquipmentIndex = Phaser.Math.Wrap(
      this.selectedEquipmentIndex + direction,
      0,
      ownedEquipment.length
    );
    this.setMessage("");
    this.renderContent();
  }

  private canUseInventoryItem(itemId: ItemId): boolean {
    const save = getSave();
    if (getItemCount(itemId) <= 0) {
      return false;
    }

    if (canItemEscapeDungeon(itemId)) {
      return save.mapId === "dungeon";
    }

    return (
      (canItemHealHp(itemId) && save.hp < getPlayerMaxHp()) ||
      (canItemRestoreMp(itemId) && save.mp < getPlayerMaxMp())
    );
  }

  private getItemUseMessage(itemName: string, healed: number, restoredMp: number): string {
    const parts: string[] = [];
    if (healed > 0) {
      parts.push(`HPを${healed}`);
    }
    if (restoredMp > 0) {
      parts.push(`MPを${restoredMp}`);
    }

    return `${itemName}で${parts.join("、")}回復した。`;
  }

  private getItemFailureMessage(reason?: string): string {
    if (reason === "full-hp") {
      return "HPは満タンだ。";
    }
    if (reason === "full-mp") {
      return "MPは満タンだ。";
    }
    return "アイテムを使えなかった。";
  }

  private getSelectedSkillUseLabel(
    learned: boolean,
    isHeal: boolean,
    canUseSelected: boolean
  ): string {
    if (!learned) {
      return "未習得";
    }

    if (!isHeal) {
      return "戦闘専用";
    }

    if (canUseSelected) {
      return "使う";
    }

    const save = getSave();
    if (save.mp < SKILLS[SKILL_ORDER[this.selectedSkillIndex]].mpCost) {
      return "MP不足";
    }

    return "満タン";
  }

  private getOwnedEquipmentIds(): EquipmentId[] {
    return EQUIPMENT_ORDER.filter((equipmentId) => getEquipmentCount(equipmentId) > 0);
  }

  private getVisibleOwnedEquipment(ownedEquipment: EquipmentId[]): {
    start: number;
    visible: EquipmentId[];
  } {
    const visibleCount = 6;
    const start = Phaser.Math.Clamp(
      this.selectedEquipmentIndex - Math.floor(visibleCount / 2),
      0,
      Math.max(0, ownedEquipment.length - visibleCount)
    );
    return {
      start,
      visible: ownedEquipment.slice(start, start + visibleCount)
    };
  }

  private updateTabs(): void {
    this.getVisibleTabs().forEach((tab) => {
      const selected = this.activeTab === tab;
      this.tabButtons[tab]?.setStyle({
        color: selected ? "#101820" : "#f4f0db",
        backgroundColor: selected ? "#f2d27a" : "#263442"
      });
    });
  }

  private clearContent(): void {
    this.contentObjects.forEach((object) => object.destroy());
    this.contentObjects = [];
  }

  private addContent<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.contentObjects.push(object);
    return object;
  }

  private setMessage(message: string): void {
    this.messageText?.setText(message);
  }

  private currentMapName(): string {
    const save = getSave();
    if (save.mapId === "dungeon") {
      return `${getDungeonNameForTier(getActiveDungeonTier())} B${getCurrentDungeonFloor()}F/${getDungeonFloorCount() ?? "?"}F`;
    }
    return getMapDefinition(save.mapId, isExpandedWorldUnlocked()).name;
  }

  private closeMenu(): void {
    this.game.events.emit(GAME_EVENTS.menuClosed);
    this.scene.stop();
  }

  private cleanup(): void {
    this.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.clearContent();
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
