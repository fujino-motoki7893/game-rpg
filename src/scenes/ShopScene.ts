import Phaser from "phaser";
import { getItemBuyPrice, getItemSellPrice, ITEM_ORDER, ITEMS } from "../data/items";
import { GAME_EVENTS } from "../game/constants";
import { buyItem, getItemCount, getSave, sellItem } from "../game/GameState";

type ShopTab = "buy" | "sell";

const TABS: ShopTab[] = ["buy", "sell"];
const TAB_LABELS: Record<ShopTab, string> = {
  buy: "買う",
  sell: "売る"
};

export class ShopScene extends Phaser.Scene {
  private activeTab: ShopTab = "buy";
  private selectedItemIndex = 0;
  private tabButtons: Partial<Record<ShopTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private messageText?: Phaser.GameObjects.Text;
  private goldText?: Phaser.GameObjects.Text;

  constructor() {
    super("ShopScene");
  }

  create(): void {
    this.activeTab = "buy";
    this.selectedItemIndex = 0;
    this.contentObjects = [];
    this.tabButtons = {};

    this.add.rectangle(400, 320, 800, 640, 0x05080b, 0.58).setDepth(90);
    this.add
      .rectangle(400, 320, 560, 424, 0x101923, 0.98)
      .setStrokeStyle(3, 0xd8bc72)
      .setDepth(100);
    this.add.rectangle(400, 154, 508, 2, 0xf0d98a, 0.75).setDepth(101);
    this.add.text(154, 120, "道具屋", this.textStyle(25, "#f6e4a4")).setDepth(102);

    this.createTabButton("buy", 154, 176);
    this.createTabButton("sell", 276, 176);
    this.createCloseButton();
    this.goldText = this.add.text(426, 182, "", this.textStyle(18, "#f4df7e")).setDepth(102);
    this.messageText = this.add.text(154, 492, "", this.textStyle(16, "#f6e4a4")).setDepth(102);

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.events.once("shutdown", this.cleanup, this);
    this.renderContent();
  }

  private createTabButton(tab: ShopTab, x: number, y: number): void {
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
      .on("pointerdown", () => this.closeShop());
  }

  private selectTab(tab: ShopTab): void {
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
    this.goldText?.setText(`G ${getSave().gold}`);

    ITEM_ORDER.forEach((itemId, index) => {
      const item = ITEMS[itemId];
      const selected = index === this.selectedItemIndex;
      const count = getItemCount(itemId);
      const price = this.activeTab === "buy" ? getItemBuyPrice(itemId) : getItemSellPrice(itemId);
      const canTrade = this.canTradeSelected(index);
      const y = 224 + index * 48;
      const row = this.add
        .rectangle(388, y + 14, 468, 42, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8bc72 : 0x34475a, selected ? 0.9 : 0.45)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.selectItem(index));
      this.addContent(row);
      this.addContent(
        this.add.text(164, y, selected ? ">" : "", this.textStyle(18, "#f6e4a4")).setDepth(102)
      );
      this.addContent(
        this.add.text(190, y, item.name, this.textStyle(18, "#fff4cf")).setDepth(102)
      );
      this.addContent(
        this.add.text(312, y, `${price}G`, this.textStyle(17, canTrade ? "#f4df7e" : "#748393")).setDepth(102)
      );
      this.addContent(
        this.add.text(390, y, `所持 x${count}`, this.textStyle(15, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(496, y, item.description, this.textStyle(14, "#9fb4c6")).setDepth(102)
      );
    });

    const selectedItemId = ITEM_ORDER[this.selectedItemIndex];
    const selectedCanTrade = this.canTradeSelected(this.selectedItemIndex);
    const actionLabel = this.activeTab === "buy" ? "買う" : "売る";
    const actionButton = this.add
      .text(530, 412, actionLabel, {
        ...this.textStyle(18, selectedCanTrade ? "#101820" : "#2a3036"),
        backgroundColor: selectedCanTrade ? "#f2d27a" : "#66707a",
        padding: { x: 18, y: 10 },
        fixedWidth: 92,
        align: "center"
      })
      .setAlpha(selectedCanTrade ? 1 : 0.58)
      .setDepth(102);

    if (selectedCanTrade) {
      actionButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.tradeSelectedItem());
    }
    this.addContent(actionButton);
    this.addContent(
      this.add
        .text(
          154,
          416,
          `${ITEMS[selectedItemId].name}  買値 ${getItemBuyPrice(selectedItemId)}G  売値 ${getItemSellPrice(selectedItemId)}G`,
          this.textStyle(16, "#f4df7e")
        )
        .setDepth(102)
    );
  }

  private selectItem(index: number): void {
    this.selectedItemIndex = Phaser.Math.Clamp(index, 0, ITEM_ORDER.length - 1);
    this.setMessage("");
    this.renderContent();
  }

  private tradeSelectedItem(): void {
    const itemId = ITEM_ORDER[this.selectedItemIndex];
    const item = ITEMS[itemId];

    if (this.activeTab === "buy") {
      const result = buyItem(itemId);
      if (!result.bought) {
        this.setMessage("ゴールドが足りない。");
        return;
      }
      this.setMessage(`${item.name}を${result.price}Gで買った。`);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.renderContent();
      return;
    }

    const result = sellItem(itemId);
    if (!result.sold) {
      this.setMessage(`${item.name}を持っていない。`);
      return;
    }
    this.setMessage(`${item.name}を${result.price}Gで売った。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private canTradeSelected(index: number): boolean {
    const itemId = ITEM_ORDER[index];
    if (this.activeTab === "buy") {
      return getSave().gold >= getItemBuyPrice(itemId);
    }
    return getItemCount(itemId) > 0;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape" || event.code === "KeyM") {
      this.closeShop();
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

    if (event.code === "ArrowUp") {
      this.moveSelectedItem(-1);
      return;
    }

    if (event.code === "ArrowDown") {
      this.moveSelectedItem(1);
      return;
    }

    if (event.code === "Space" || event.code === "Enter") {
      this.tradeSelectedItem();
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

  private closeShop(): void {
    this.game.events.emit(GAME_EVENTS.shopClosed);
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
