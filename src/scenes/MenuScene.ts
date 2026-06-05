import Phaser from "phaser";
import { ITEM_ORDER, ITEMS } from "../data/items";
import { MAPS } from "../data/maps";
import { getSkillHealAmount, SKILL_ORDER, SKILLS } from "../data/skills";
import { GAME_EVENTS } from "../game/constants";
import {
  getCurrentDungeonFloor,
  getDungeonFloorCount,
  getItemCount,
  getSave,
  useHealingSkill,
  useItem
} from "../game/GameState";

type MenuTab = "items" | "skills" | "status";

const TABS: MenuTab[] = ["items", "skills", "status"];
const TAB_LABELS: Record<MenuTab, string> = {
  items: "持ち物",
  skills: "スキル",
  status: "強さ"
};

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = "items";
  private selectedItemIndex = 0;
  private selectedSkillIndex = 0;
  private tabButtons: Partial<Record<MenuTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private messageText?: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.activeTab = "items";
    this.selectedItemIndex = 0;
    this.selectedSkillIndex = 0;
    this.contentObjects = [];
    this.tabButtons = {};

    this.add.rectangle(400, 320, 800, 640, 0x05080b, 0.58).setDepth(90);
    this.add
      .rectangle(400, 320, 560, 424, 0x101923, 0.98)
      .setStrokeStyle(3, 0xd8bc72)
      .setDepth(100);
    this.add.rectangle(400, 154, 508, 2, 0xf0d98a, 0.75).setDepth(101);
    this.add.text(154, 120, "メニュー", this.textStyle(25, "#f6e4a4")).setDepth(102);

    this.createTabButton("items", 154, 176);
    this.createTabButton("skills", 276, 176);
    this.createTabButton("status", 398, 176);
    this.createCloseButton();
    this.messageText = this.add
      .text(154, 492, "", this.textStyle(16, "#f6e4a4"))
      .setDepth(102);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once("shutdown", this.cleanup, this);
    this.renderContent();
  }

  private createTabButton(tab: MenuTab, x: number, y: number): void {
    const button = this.add
      .text(x, y, TAB_LABELS[tab], {
        ...this.textStyle(18, "#101820"),
        backgroundColor: "#f2d27a",
        padding: { x: 18, y: 9 },
        fixedWidth: 96,
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

    this.renderStatus();
  }

  private renderItems(): void {
    const save = getSave();
    const selectedItem = ITEM_ORDER[this.selectedItemIndex];
    const canUseSelected = getItemCount(selectedItem) > 0 && save.hp < save.maxHp;

    ITEM_ORDER.forEach((itemId, index) => {
      const item = ITEMS[itemId];
      const selected = index === this.selectedItemIndex;
      const count = getItemCount(itemId);
      const y = 232 + index * 56;
      const row = this.add
        .rectangle(388, y + 15, 468, 46, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
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
        this.add.text(190, y, item.name, this.textStyle(19, "#fff4cf")).setDepth(102)
      );
      this.addContent(
        this.add.text(330, y, `x${count}`, this.textStyle(18, "#d9e5ef")).setDepth(102)
      );
      this.addContent(
        this.add.text(404, y, item.description, this.textStyle(15, "#9fb4c6")).setDepth(102)
      );
    });

    this.addContent(
      this.add
        .text(154, 416, `現在HP ${save.hp}/${save.maxHp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
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
    const selectedSkillId = SKILL_ORDER[this.selectedSkillIndex];
    const selectedSkill = SKILLS[selectedSkillId];
    const selectedLearned = save.level >= selectedSkill.requiredLevel;
    const selectedIsHeal = selectedSkill.effect.type === "heal";
    const canUseSelected =
      selectedLearned && selectedIsHeal && save.mp >= selectedSkill.mpCost && save.hp < save.maxHp;

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
        .text(154, 416, `現在HP ${save.hp}/${save.maxHp}  MP ${save.mp}/${save.maxMp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
    );

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
      useButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useSelectedSkill());
    }
    this.addContent(useButton);

    if (selectedSkill.effect.type === "heal") {
      this.addContent(
        this.add
          .text(
            154,
            452,
            `回復量 ${getSkillHealAmount(selectedSkill, save.maxHp)}`,
            this.textStyle(15, "#9fb4c6")
          )
          .setDepth(102)
      );
    }
  }

  private renderStatus(): void {
    const save = getSave();
    const rows = [
      ["レベル", String(save.level)],
      ["HP", `${save.hp}/${save.maxHp}`],
      ["MP", `${save.mp}/${save.maxMp}`],
      ["攻撃", String(save.attack)],
      ["EXP", String(save.exp)],
      ["次のレベルまで", String(Math.max(0, save.level * 12 - save.exp))],
      ["ゴールド", String(save.gold)],
      ["現在地", this.currentMapName()]
    ];

    rows.forEach(([label, value], index) => {
      const y = 232 + index * 36;
      this.addContent(
        this.add.text(154, y, label, this.textStyle(17, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(342, y, value, this.textStyle(18, "#fff4cf")).setDepth(102)
      );
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

  private useSelectedItem(): void {
    const itemId = ITEM_ORDER[this.selectedItemIndex];
    const item = ITEMS[itemId];
    const save = getSave();
    if (getItemCount(itemId) <= 0) {
      this.setMessage(`${item.name}を持っていない。`);
      return;
    }

    if (save.hp >= save.maxHp) {
      this.setMessage("HPは満タンだ。");
      return;
    }

    const result = useItem(itemId);
    if (!result.used) {
      this.setMessage(`${item.name}を使えなかった。`);
      return;
    }

    this.setMessage(`${item.name}でHPを${result.healed}回復した。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private useSelectedSkill(): void {
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

    if (save.hp >= save.maxHp) {
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

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "items") {
      this.useSelectedItem();
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "skills") {
      this.useSelectedSkill();
    }
  }

  private moveTab(direction: number): void {
    const currentIndex = TABS.indexOf(this.activeTab);
    const nextIndex = Phaser.Math.Wrap(currentIndex + direction, 0, TABS.length);
    this.selectTab(TABS[nextIndex]);
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

  private updateTabs(): void {
    TABS.forEach((tab) => {
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
      return `${MAPS.dungeon.name} B${getCurrentDungeonFloor()}F/${getDungeonFloorCount() ?? "?"}F`;
    }
    return MAPS[save.mapId].name;
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
