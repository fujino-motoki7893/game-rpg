import Phaser from "phaser";
import { MAPS } from "../data/maps";
import { GAME_EVENTS } from "../game/constants";
import { getCurrentDungeonFloor, getDungeonFloorCount, getSave, usePotion } from "../game/GameState";

type MenuTab = "items" | "status";

const TABS: MenuTab[] = ["items", "status"];
const TAB_LABELS: Record<MenuTab, string> = {
  items: "持ち物",
  status: "強さ"
};

export class MenuScene extends Phaser.Scene {
  private activeTab: MenuTab = "items";
  private tabButtons: Partial<Record<MenuTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private messageText?: Phaser.GameObjects.Text;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.activeTab = "items";
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
    this.createTabButton("status", 276, 176);
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

    this.renderStatus();
  }

  private renderItems(): void {
    const save = getSave();
    const canUsePotion = save.potions > 0 && save.hp < save.maxHp;

    this.addContent(
      this.add.text(154, 232, "薬草", this.textStyle(21, "#fff4cf")).setDepth(102)
    );
    this.addContent(
      this.add
        .text(154, 270, `所持数 ${save.potions}`, this.textStyle(18, "#d9e5ef"))
        .setDepth(102)
    );
    this.addContent(
      this.add
        .text(154, 306, "HPを16回復する", this.textStyle(17, "#9fb4c6"))
        .setDepth(102)
    );
    this.addContent(
      this.add
        .text(154, 354, `現在HP ${save.hp}/${save.maxHp}`, this.textStyle(18, "#f4df7e"))
        .setDepth(102)
    );

    const useButton = this.add
      .text(530, 266, "使う", {
        ...this.textStyle(18, canUsePotion ? "#101820" : "#2a3036"),
        backgroundColor: canUsePotion ? "#f2d27a" : "#66707a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(canUsePotion ? 1 : 0.58)
      .setDepth(102);

    if (canUsePotion) {
      useButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.useHerb());
    }
    this.addContent(useButton);
  }

  private renderStatus(): void {
    const save = getSave();
    const rows = [
      ["レベル", String(save.level)],
      ["HP", `${save.hp}/${save.maxHp}`],
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

  private useHerb(): void {
    const save = getSave();
    if (save.potions <= 0) {
      this.setMessage("薬草を持っていない。");
      return;
    }

    if (save.hp >= save.maxHp) {
      this.setMessage("HPは満タンだ。");
      return;
    }

    const healed = Math.min(16, save.maxHp - save.hp);
    if (!usePotion()) {
      this.setMessage("薬草を使えなかった。");
      return;
    }

    this.setMessage(`薬草でHPを${healed}回復した。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape" || event.code === "KeyM") {
      this.closeMenu();
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "ArrowUp") {
      this.moveTab(-1);
      return;
    }

    if (event.code === "ArrowRight" || event.code === "ArrowDown") {
      this.moveTab(1);
      return;
    }

    if ((event.code === "Space" || event.code === "Enter") && this.activeTab === "items") {
      this.useHerb();
    }
  }

  private moveTab(direction: number): void {
    const currentIndex = TABS.indexOf(this.activeTab);
    const nextIndex = Phaser.Math.Wrap(currentIndex + direction, 0, TABS.length);
    this.selectTab(TABS[nextIndex]);
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
