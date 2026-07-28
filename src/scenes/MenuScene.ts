import Phaser from "phaser";
import { getCharacterIdleAnimationKey } from "../data/characterSprites";
import { COMPANIONS, COMPANION_ORDER, isCompanionId } from "../data/companions";
import {
  EQUIPMENT,
  EQUIPMENT_ORDER,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  getEquipmentRarityLabel,
  getEquipmentStatSummary,
  getEquipmentUpgradeLabel
} from "../data/equipment";
import {
  fetchCompanionLine,
  getCompanionChatStage,
  getCompanionLine,
  getJournalEntries,
  getNextStaticCompanionLine
} from "../data/dialogues";
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
  getCompanionAttack,
  getCompanionDefense,
  getCompanionEquippedEquipment,
  getCompanionHp,
  getCompanionMaxHp,
  getCompanionMaxMp,
  getCompanionMp,
  getCompanionSpeed,
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  getEquipmentCount,
  getEquipmentUpgradeLevel,
  getEquippedEquipment,
  getItemCount,
  getPlayerAttack,
  getPlayerDefense,
  getPlayerSpeed,
  getPlayerMaxHp,
  getPlayerMaxMp,
  getSave,
  hasCompanion,
  isExpandedWorldUnlocked,
  consumeItem,
  equipEquipment,
  equipEquipmentToCompanion,
  useHealingSkill,
  useHealingSkillOnCompanion,
  useItem,
  useItemOnCompanion
} from "../game/GameState";
import type { CompanionId } from "../data/companions";
import type { EquipmentId, ItemId } from "../game/types";

type MenuTab = "items" | "skills" | "equipment" | "status" | "journal";
type CharacterKey = "hero" | CompanionId;

const BASE_TABS: MenuTab[] = ["items", "skills", "equipment", "status", "journal"];
const BASE_TAB_LABELS: Record<MenuTab, string> = {
  items: "持ち物",
  skills: "スキル",
  equipment: "装備",
  status: "強さ",
  journal: "日誌"
};

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = "items";
  private selectedItemIndex = 0;
  private selectedSkillIndex = 0;
  private selectedEquipmentIndex = 0;
  private skillsCharacter: CharacterKey = "hero";
  private equipmentCharacter: CharacterKey = "hero";
  private statusCharacter: CharacterKey = "hero";
  private tabButtons: Partial<Record<MenuTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private contentContainer!: Phaser.GameObjects.Container;
  private contentMaskShape?: Phaser.GameObjects.Rectangle;
  private contentScrollY = 0;
  private contentMaxScroll = 0;
  private readonly contentViewport = { x: 130, y: 200, width: 540, height: 280 };
  private messageText?: Phaser.GameObjects.Text;
  private companionLines = new Map<CompanionId, string>();
  private companionLoading = new Set<CompanionId>();
  private companionRequestTokens = new Map<CompanionId, number>();

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.activeTab = "items";
    this.selectedItemIndex = 0;
    this.selectedSkillIndex = 0;
    this.selectedEquipmentIndex = 0;
    this.skillsCharacter = "hero";
    this.equipmentCharacter = "hero";
    this.statusCharacter = "hero";
    this.contentObjects = [];
    this.tabButtons = {};
    this.companionLines = new Map();
    this.companionLoading = new Set();
    this.companionRequestTokens = new Map();
    this.contentScrollY = 0;
    this.contentMaxScroll = 0;

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

    this.contentContainer = this.add.container(0, 0).setDepth(101);
    // Phaser 4 dropped WebGL support for GeometryMask/setMask (silently
    // no-ops with a console warning) in favor of the Filters system, so
    // clipping the scrollable content to the panel needs an external Mask
    // filter instead: an invisible rectangle GameObject whose screen-space
    // bounds (unaffected by the container's own scroll transform) define
    // what's visible.
    this.contentMaskShape = this.add
      .rectangle(
        this.contentViewport.x + this.contentViewport.width / 2,
        this.contentViewport.y + this.contentViewport.height / 2,
        this.contentViewport.width,
        this.contentViewport.height,
        0xffffff
      )
      .setVisible(false);
    this.contentContainer.enableFilters();
    this.contentContainer.filters!.external.addMask(this.contentMaskShape);

    this.messageText = this.add
      .text(154, 492, "", this.textStyle(16, "#f6e4a4"))
      .setDepth(102);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.input.on("wheel", this.handleContentWheel, this);
    this.events.once("shutdown", this.cleanup, this);
    this.renderContent();
  }

  private getVisibleTabs(): MenuTab[] {
    return BASE_TABS;
  }

  private getActiveAllies(): CompanionId[] {
    return COMPANION_ORDER.filter((id) => hasCompanion(id));
  }

  private getTabLabel(tab: MenuTab): string {
    return BASE_TAB_LABELS[tab];
  }

  private createTabButton(tab: MenuTab, x: number, y: number, width: number): void {
    const button = this.add
      .text(x, y, this.getTabLabel(tab), {
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
    } else if (this.activeTab === "skills") {
      this.renderSkills();
    } else if (this.activeTab === "equipment") {
      this.renderEquipment();
    } else if (this.activeTab === "status") {
      this.renderStatus();
    } else if (this.activeTab === "journal") {
      this.renderJournal();
    }

    this.finalizeContentScroll();
  }

  private finalizeContentScroll(): void {
    const viewportBottom = this.contentViewport.y + this.contentViewport.height;
    let maxBottom = viewportBottom;
    this.contentObjects.forEach((object) => {
      const withBounds = object as unknown as { getBounds?: () => Phaser.Geom.Rectangle };
      if (typeof withBounds.getBounds === "function") {
        maxBottom = Math.max(maxBottom, withBounds.getBounds().bottom);
      }
    });
    this.contentMaxScroll = Math.max(0, maxBottom - viewportBottom);
  }

  private scrollContentBy(delta: number): void {
    if (this.contentMaxScroll <= 0) {
      return;
    }

    this.contentScrollY = Phaser.Math.Clamp(this.contentScrollY + delta, 0, this.contentMaxScroll);
    this.contentContainer.y = -this.contentScrollY;
  }

  private handleContentWheel(
    _pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    this.scrollContentBy(deltaY);
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

    // Positioned relative to the item list's actual length (not a fixed
    // constant) so this footer never overlaps the rows above it — it used
    // to be hardcoded assuming 5 items, which broke once cure items grew
    // ITEM_ORDER to 9.
    const listBottom = 216 + ITEM_ORDER.length * 40;
    this.addContent(
      this.add
        .text(154, listBottom, `現在HP ${save.hp}/${maxHp}  MP ${save.mp}/${maxMp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
    );

    const activeAllies = this.getActiveAllies();
    const showAllyTarget =
      activeAllies.length > 0 && (canItemHealHp(selectedItem) || canItemRestoreMp(selectedItem));

    if (showAllyTarget) {
      const count = getItemCount(selectedItem);
      const canUseOn = (hp: number, maxAllyHp: number, mp: number, maxAllyMp: number) =>
        count > 0 &&
        ((canItemHealHp(selectedItem) && hp < maxAllyHp) ||
          (canItemRestoreMp(selectedItem) && mp < maxAllyMp));
      const canUseSelf = canUseOn(save.hp, maxHp, save.mp, maxMp);

      let allyLineY = listBottom + 24;
      activeAllies.forEach((id) => {
        const definition = COMPANIONS[id];
        this.addContent(
          this.add
            .text(
              154,
              allyLineY,
              `${definition.name} HP ${getCompanionHp(id)}/${getCompanionMaxHp(id)}  MP ${getCompanionMp(id)}/${getCompanionMaxMp(id)}`,
              this.textStyle(15, definition.hpBarColorHex)
            )
            .setDepth(102)
        );
        allyLineY += 20;
      });
      this.addContent(
        this.add.text(154, allyLineY, `所持ゴールド ${save.gold}G`, this.textStyle(15, "#d9e5ef")).setDepth(102)
      );

      this.renderAllyTargetButtons(
        listBottom - 4,
        canUseSelf,
        (id) => canUseOn(getCompanionHp(id), getCompanionMaxHp(id), getCompanionMp(id), getCompanionMaxMp(id)),
        (target) => this.useSelectedItem(target)
      );
    } else {
      this.addContent(
        this.add
          .text(154, listBottom + 24, `所持ゴールド ${save.gold}G`, this.textStyle(15, "#d9e5ef"))
          .setDepth(102)
      );

      const useButton = this.add
        .text(530, listBottom - 4, "使う", {
          ...this.textStyle(18, canUseSelected ? "#101820" : "#2a3036"),
          backgroundColor: canUseSelected ? "#f2d27a" : "#66707a",
          padding: { x: 18, y: 10 },
          fixedWidth: 92,
          align: "center"
        })
        .setAlpha(canUseSelected ? 1 : 0.58)
        .setDepth(102);

      if (canUseSelected) {
        useButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useSelectedItem("self"));
      }
      this.addContent(useButton);
    }
  }

  private renderSkills(): void {
    const activeAllies = this.getActiveAllies();
    if (activeAllies.length > 0) {
      this.renderCharacterToggle(this.skillsCharacter, (character) => {
        this.skillsCharacter = character;
      });
    }

    if (isCompanionId(this.skillsCharacter) && hasCompanion(this.skillsCharacter)) {
      this.renderCompanionSkillList(this.skillsCharacter);
      return;
    }

    this.renderHeroSkills();
  }

  private renderCharacterToggle(
    current: CharacterKey,
    onSelect: (character: CharacterKey) => void
  ): void {
    const options: { key: CharacterKey; label: string }[] = [{ key: "hero", label: "主人公" }];
    this.getActiveAllies().forEach((id) => {
      options.push({ key: id, label: COMPANIONS[id].name });
    });

    options.forEach((option, index) => {
      const selected = current === option.key;
      const button = this.add
        .text(154 + index * 92, 222, option.label, {
          ...this.textStyle(14, selected ? "#101820" : "#d9e5ef"),
          backgroundColor: selected ? "#f2d27a" : "#1c2732",
          padding: { x: 12, y: 6 },
          fixedWidth: 84,
          align: "center"
        })
        .setDepth(102)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          if (current === option.key) {
            return;
          }
          onSelect(option.key);
          this.setMessage("");
          this.renderContent();
        });
      this.addContent(button);
    });
  }

  /**
   * Right-aligned row of "self"/ally target buttons, one per companion
   * actually in the party, shrinking to bare names once there are more
   * than two targets to fit them all.
   */
  private renderAllyTargetButtons(
    y: number,
    selfEnabled: boolean,
    allyEnabled: (id: CompanionId) => boolean,
    onSelect: (target: "self" | CompanionId) => void
  ): void {
    const activeAllies = this.getActiveAllies();
    const compact = activeAllies.length > 1;
    const options: Array<{ target: "self" | CompanionId; label: string; enabled: boolean }> = [
      { target: "self", label: compact ? "自分" : "自分に使う", enabled: selfEnabled }
    ];
    activeAllies.forEach((id) => {
      const name = COMPANIONS[id].name;
      options.push({ target: id, label: compact ? name : `${name}に使う`, enabled: allyEnabled(id) });
    });

    const width = options.length > 2 ? 74 : 90;
    const gap = 6;
    const totalWidth = options.length * width + (options.length - 1) * gap;
    const rightEdge = 638;
    const startX = rightEdge - totalWidth;

    options.forEach((option, index) => {
      const x = startX + index * (width + gap);
      const button = this.add
        .text(x, y, option.label, {
          ...this.textStyle(options.length > 2 ? 13 : 16, option.enabled ? "#101820" : "#2a3036"),
          backgroundColor: option.enabled ? "#f2d27a" : "#66707a",
          padding: { x: 8, y: 10 },
          fixedWidth: width,
          align: "center"
        })
        .setAlpha(option.enabled ? 1 : 0.58)
        .setDepth(102);
      if (option.enabled) {
        button.setInteractive({ useHandCursor: true }).on("pointerdown", () => onSelect(option.target));
      }
      this.addContent(button);
    });
  }

  private renderCompanionSkillList(id: CompanionId): void {
    const save = getSave();
    const definition = COMPANIONS[id];

    definition.getAllSkills().forEach((skill, index) => {
      const learned = save.level >= skill.requiredLevel;
      const y = 259 + index * 40;
      const row = this.add
        .rectangle(388, y + 14, 468, 38, 0x111a24, 0.58)
        .setStrokeStyle(1, 0x34475a, 0.45)
        .setDepth(101);
      this.addContent(row);
      this.addContent(
        this.add
          .text(190, y, skill.name, this.textStyle(18, learned ? "#fff4cf" : "#748393"))
          .setDepth(102)
      );
      this.addContent(
        this.add
          .text(306, y, skill.mpCost > 0 ? `MP${skill.mpCost}` : "-", this.textStyle(16, learned ? "#d9e5ef" : "#748393"))
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
        .text(
          154,
          416,
          `${definition.name} HP ${getCompanionHp(id)}/${getCompanionMaxHp(id)}  MP ${getCompanionMp(id)}/${getCompanionMaxMp(id)}`,
          this.textStyle(18, definition.hpBarColorHex)
        )
        .setDepth(102)
    );
    this.addContent(
      this.add.text(154, 440, definition.behaviorDescription, this.textStyle(14, "#9fb4c6")).setDepth(102)
    );
  }

  private renderHeroSkills(): void {
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
      const y = 259 + index * 40;
      const row = this.add
        .rectangle(388, y + 14, 468, 38, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
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

    const activeAllies = this.getActiveAllies();
    if (activeAllies.length > 0 && selectedIsHeal) {
      const canAfford = selectedLearned && save.mp >= selectedSkill.mpCost;
      const canUseSelf = canAfford && save.hp < maxHp;

      let allyLineY = 440;
      activeAllies.forEach((id) => {
        const definition = COMPANIONS[id];
        this.addContent(
          this.add
            .text(154, allyLineY, `${definition.name} HP ${getCompanionHp(id)}/${getCompanionMaxHp(id)}`, this.textStyle(15, definition.hpBarColorHex))
            .setDepth(102)
        );
        allyLineY += 20;
      });

      this.renderAllyTargetButtons(
        412,
        canUseSelf,
        (id) => canAfford && getCompanionHp(id) < getCompanionMaxHp(id),
        (target) => this.useSelectedSkill(target)
      );
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

  // Upgrade level is global to the equipment id (see GameState's
  // equipmentUpgrades), so the "+N" suffix belongs wherever the id's name
  // is shown, not just a dedicated upgrade screen.
  private getEquipmentDisplayName(equipmentId: EquipmentId): string {
    const label = getEquipmentUpgradeLabel(getEquipmentUpgradeLevel(equipmentId));
    return label ? `${EQUIPMENT[equipmentId].name} ${label}` : EQUIPMENT[equipmentId].name;
  }

  private renderEquipment(): void {
    const save = getSave();
    const ownedEquipment = this.getOwnedEquipmentIds();
    this.selectedEquipmentIndex = Phaser.Math.Clamp(
      this.selectedEquipmentIndex,
      0,
      Math.max(0, ownedEquipment.length - 1)
    );

    const activeAllies = this.getActiveAllies();
    if (activeAllies.length > 0) {
      this.renderCharacterToggle(this.equipmentCharacter, (character) => {
        this.equipmentCharacter = character;
      });
    }

    const showingId =
      isCompanionId(this.equipmentCharacter) && hasCompanion(this.equipmentCharacter)
        ? this.equipmentCharacter
        : undefined;

    this.addContent(
      this.add.text(154, 258, "装備中", this.textStyle(16, "#f4df7e")).setDepth(102)
    );
    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const y = 282 + index * 20;
      const equipmentId = showingId ? getCompanionEquippedEquipment(showingId, slot) : getEquippedEquipment(slot);
      const name = equipmentId ? this.getEquipmentDisplayName(equipmentId) : "-";
      this.addContent(
        this.add.text(154, y, EQUIPMENT_SLOT_LABELS[slot], this.textStyle(13, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(228, y, name, this.textStyle(13, equipmentId ? "#fff4cf" : "#748393")).setDepth(102)
      );
    });

    this.addContent(
      this.add.text(404, 258, "所持装備", this.textStyle(16, "#f4df7e")).setDepth(102)
    );

    if (ownedEquipment.length === 0) {
      this.addContent(
        this.add.text(404, 286, "装備品なし", this.textStyle(15, "#748393")).setDepth(102)
      );
    } else {
      const { start, visible } = this.getVisibleOwnedEquipment(ownedEquipment);
      visible.forEach((equipmentId, visibleIndex) => {
        const index = start + visibleIndex;
        const selected = index === this.selectedEquipmentIndex;
        const y = 282 + visibleIndex * 34;
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
          this.add.text(424, y, this.getEquipmentDisplayName(equipmentId), this.textStyle(13, "#fff4cf")).setDepth(102)
        );
        this.addContent(
          this.add.text(548, y, getEquipmentRarityLabel(equipmentId), this.textStyle(12, "#f4df7e")).setDepth(102)
        );
        this.addContent(
          this.add.text(594, y, `x${getEquipmentCount(equipmentId)}`, this.textStyle(12, "#d9e5ef")).setDepth(102)
        );
        this.addContent(
          this.add
            .text(424, y + 14, getEquipmentStatSummary(equipmentId, getEquipmentUpgradeLevel(equipmentId)), this.textStyle(11, "#9fb4c6"))
            .setDepth(102)
        );
      });
    }

    const statsLine = showingId
      ? `${COMPANIONS[showingId].name} HP ${getCompanionHp(showingId)}/${getCompanionMaxHp(showingId)}  MP ${getCompanionMp(showingId)}/${getCompanionMaxMp(showingId)}  攻 ${getCompanionAttack(showingId)}  防 ${getCompanionDefense(showingId)}  速 ${getCompanionSpeed(showingId)}`
      : `HP ${save.hp}/${getPlayerMaxHp()}  MP ${save.mp}/${getPlayerMaxMp()}  攻 ${getPlayerAttack()}  防 ${getPlayerDefense()}  速 ${getPlayerSpeed()}`;
    this.addContent(
      this.add
        .text(154, 432, statsLine, this.textStyle(16, showingId ? COMPANIONS[showingId].hpBarColorHex : "#f4df7e"))
        .setDepth(102)
    );

    const canEquipSelected = ownedEquipment.length > 0;
    const equipButton = this.add
      .text(530, 428, "装備", {
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
    const activeAllies = this.getActiveAllies();
    if (activeAllies.length > 0) {
      this.renderCharacterToggle(this.statusCharacter, (character) => {
        this.statusCharacter = character;
      });
    }

    const showingId =
      isCompanionId(this.statusCharacter) && hasCompanion(this.statusCharacter) ? this.statusCharacter : undefined;
    const startY = activeAllies.length > 0 ? 259 : 226;

    const save = getSave();
    // EXP/level-up progress is shared party-wide and already shown under
    // 主人公, so the companion view skips it to leave room for the talk
    // section below without overflowing the panel.
    const rows = showingId
      ? [
          ["レベル", String(save.level)],
          ["HP", `${getCompanionHp(showingId)}/${getCompanionMaxHp(showingId)}`],
          ["MP", `${getCompanionMp(showingId)}/${getCompanionMaxMp(showingId)}`],
          ["攻撃", String(getCompanionAttack(showingId))],
          ["防御", String(getCompanionDefense(showingId))],
          ["素早さ", String(getCompanionSpeed(showingId))]
        ]
      : [
          ["レベル", String(save.level)],
          ["HP", `${save.hp}/${getPlayerMaxHp()}`],
          ["MP", `${save.mp}/${getPlayerMaxMp()}`],
          ["攻撃", String(getPlayerAttack())],
          ["防御", String(getPlayerDefense())],
          ["素早さ", String(getPlayerSpeed())],
          ["EXP", String(save.exp)],
          ["次のレベルまで", String(Math.max(0, save.level * 12 - save.exp))],
          ["ゴールド", String(save.gold)],
          ["現在地", this.currentMapName()]
        ];
    const spacing = activeAllies.length > 0 ? 26 : 32;
    const valueColor = showingId ? COMPANIONS[showingId].hpBarColorHex : "#fff4cf";

    rows.forEach(([label, value], index) => {
      const y = startY + index * spacing;
      this.addContent(
        this.add.text(154, y, label, this.textStyle(17, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(342, y, value, this.textStyle(18, valueColor)).setDepth(102)
      );
    });

    if (showingId) {
      const talkSectionY = startY + rows.length * spacing + 22;
      this.addContent(
        this.add.rectangle(154, talkSectionY - 12, 480, 2, 0x2c3946, 1).setOrigin(0, 0.5).setDepth(102)
      );
      this.renderCompanionTalk(showingId, talkSectionY);
    }
  }

  /**
   * A read-only history of completed quest milestones (derived entirely
   * from save flags via getJournalEntries — no separate journal state),
   * with the current objective highlighted at the end.
   */
  private renderJournal(): void {
    const entries = getJournalEntries();
    let y = 226;
    entries.forEach((entry) => {
      const color = entry.current ? "#f4df7e" : "#9fb4c6";
      const marker = entry.current ? "▶" : "・";
      const text = this.add
        .text(154, y, `${marker} ${entry.text}`, {
          ...this.textStyle(15, color),
          wordWrap: { width: 480, useAdvancedWrap: true }
        })
        .setDepth(102);
      this.addContent(text);
      y += text.height + 10;
    });
  }

  /**
   * A companion's "ひとこと" (one-liner chat) lives right below its stats in
   * the same 強さ tab, rather than in its own separate tab — selecting the
   * companion via the toggle above is enough to reach both.
   */
  private renderCompanionTalk(id: CompanionId, y: number): void {
    const line = this.companionLines.get(id) ?? "";
    const loading = this.companionLoading.has(id);

    if (!line && !loading) {
      this.talkToCompanion(id);
      return;
    }

    const definition = COMPANIONS[id];
    const portrait = this.add
      .sprite(190, y + 34, definition.texture, 0)
      .setOrigin(0.5, 0.5)
      .setScale(id === "luna" ? 1.6 : 1.3)
      .setDepth(102);
    const idleKey = getCharacterIdleAnimationKey(definition.texture, "down");
    if (this.anims.exists(idleKey)) {
      portrait.play(idleKey, true);
    }
    this.addContent(portrait);

    this.addContent(
      this.add
        .text(260, y, loading ? "……" : line || "……", {
          ...this.textStyle(16, "#fff4cf"),
          wordWrap: { width: 340, useAdvancedWrap: true },
          lineSpacing: 8
        })
        .setDepth(102)
    );

    const talkButton = this.add
      .text(530, y + 60, loading ? "……" : "話す", {
        ...this.textStyle(18, loading ? "#2a3036" : "#101820"),
        backgroundColor: loading ? "#66707a" : "#f2d27a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(loading ? 0.58 : 1)
      .setDepth(102);
    if (!loading) {
      talkButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.talkToCompanion(id));
    }
    this.addContent(talkButton);
  }

  private talkToCompanion(id: CompanionId): void {
    if (this.companionLoading.has(id)) {
      return;
    }

    const stage = getCompanionChatStage(id);

    // Static lines (first casual chats, and the one-off comment after each
    // story milestone) always come first; only once every static line for
    // the current stage has been seen do we reach for AI generation.
    const staticLine = getNextStaticCompanionLine(id, stage);
    if (staticLine) {
      this.companionLines.set(id, staticLine);
      this.setMessage("");
      this.renderContent();
      return;
    }

    this.companionLoading.add(id);
    this.setMessage("");
    this.renderContent();

    const requestToken = (this.companionRequestTokens.get(id) ?? 0) + 1;
    this.companionRequestTokens.set(id, requestToken);

    fetchCompanionLine(id, stage)
      .catch(() => getCompanionLine(id))
      .then((line) => {
        if (this.companionRequestTokens.get(id) !== requestToken || !this.scene.isActive()) {
          return;
        }

        this.companionLines.set(id, line);
        this.companionLoading.delete(id);
        if (this.activeTab === "status" && this.statusCharacter === id) {
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

  private useSelectedItem(target: "self" | CompanionId = "self"): void {
    const itemId = ITEM_ORDER[this.selectedItemIndex];
    const item = ITEMS[itemId];
    if (getItemCount(itemId) <= 0) {
      this.setMessage(`${item.name}を持っていない。`);
      return;
    }

    if (isCompanionId(target)) {
      const result = useItemOnCompanion(target, itemId);
      const label = `${COMPANIONS[target].name}の`;
      if (!result.used) {
        this.setMessage(this.getItemFailureMessage(result.reason, label));
        return;
      }

      this.setMessage(this.getItemUseMessage(item.name, result.healed, result.restoredMp, label));
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.renderContent();
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
    const targetId =
      isCompanionId(this.equipmentCharacter) && hasCompanion(this.equipmentCharacter)
        ? this.equipmentCharacter
        : undefined;
    const result = targetId ? equipEquipmentToCompanion(targetId, equipmentId) : equipEquipment(equipmentId);
    if (!result.equipped || !result.slot) {
      this.setMessage(`${equipment.name}を装備できなかった。`);
      return;
    }

    const targetLabel = targetId ? `${COMPANIONS[targetId].name}の` : "";
    this.setMessage(`${targetLabel}${equipment.name}を${EQUIPMENT_SLOT_LABELS[result.slot]}に装備した。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private useSelectedSkill(target: "self" | CompanionId = "self"): void {
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

    if (isCompanionId(target)) {
      const name = COMPANIONS[target].name;
      if (getCompanionHp(target) >= getCompanionMaxHp(target)) {
        this.setMessage(`${name}のHPは満タンだ。`);
        return;
      }

      const result = useHealingSkillOnCompanion(target, skillId);
      if (!result.used) {
        this.setMessage(`${skill.name}を使えなかった。`);
        return;
      }

      this.setMessage(`${skill.name}で${name}のHPを${result.healed}回復した。`);
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

    if (this.activeTab === "skills" && this.skillsCharacter === "hero" && event.code === "ArrowUp") {
      this.moveSelectedSkill(-1);
      return;
    }

    if (this.activeTab === "skills" && this.skillsCharacter === "hero" && event.code === "ArrowDown") {
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

    const scrollableTab = this.activeTab === "status" || this.activeTab === "journal";
    if (scrollableTab && event.code === "ArrowUp") {
      this.scrollContentBy(-40);
      return;
    }

    if (scrollableTab && event.code === "ArrowDown") {
      this.scrollContentBy(40);
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "items") {
      this.useSelectedItem();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "skills" && this.skillsCharacter === "hero") {
      this.useSelectedSkill();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "equipment") {
      this.equipSelectedEquipment();
      return;
    }

    if (
      (event.code === "Space" || event.code === "Enter") &&
      this.activeTab === "status" &&
      isCompanionId(this.statusCharacter)
    ) {
      this.talkToCompanion(this.statusCharacter);
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

  private getItemUseMessage(itemName: string, healed: number, restoredMp: number, targetLabel = ""): string {
    const parts: string[] = [];
    if (healed > 0) {
      parts.push(`HPを${healed}`);
    }
    if (restoredMp > 0) {
      parts.push(`MPを${restoredMp}`);
    }

    return `${itemName}で${targetLabel}${parts.join("、")}回復した。`;
  }

  private getItemFailureMessage(reason?: string, targetLabel = ""): string {
    if (reason === "full-hp") {
      return `${targetLabel}HPは満タンだ。`;
    }
    if (reason === "full-mp") {
      return `${targetLabel}MPは満タンだ。`;
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
    const visibleCount = 4;
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
    this.contentScrollY = 0;
    this.contentMaxScroll = 0;
    this.contentContainer.y = 0;
  }

  private addContent<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.contentObjects.push(object);
    this.contentContainer.add(object);
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
    this.input.off("wheel", this.handleContentWheel, this);
    this.clearContent();
    this.contentMaskShape?.destroy();
  }

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: '"Yu Gothic", Meiryo, "Hiragino Sans", "Noto Sans JP", sans-serif',
      fontSize: `${size}px`,
      color
    };
  }
}
