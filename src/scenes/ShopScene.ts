import Phaser from "phaser";
import {
  EQUIPMENT,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_ORDER,
  EQUIPMENT_SHOP_ORDER,
  getEquipmentBuyPrice,
  getEquipmentRarityLabel,
  getEquipmentSellPrice,
  getEquipmentStatDelta,
  getEquipmentStatSummary,
  getEquipmentUpgradeCost,
  getEquipmentUpgradeLabel,
  isEquipmentBuyable,
  MAX_EQUIPMENT_UPGRADE_LEVEL
} from "../data/equipment";
import {
  getItemBuyPrice,
  getItemRarityLabel,
  getItemSellPrice,
  isItemBuyable,
  ITEM_ORDER,
  ITEMS,
  SHOP_BUY_ITEM_ORDER
} from "../data/items";
import { COMPANIONS, COMPANION_ORDER } from "../data/companions";
import { GAME_EVENTS } from "../game/constants";
import {
  buyEquipment,
  buyItem,
  getCompanionEquippedEquipment,
  getEquipmentCount,
  getEquipmentUpgradeLevel,
  getEquippedEquipment,
  getItemCount,
  getSave,
  hasCompanion,
  isEquipmentOwnedAnywhere,
  previewEquipmentSlot,
  sellEquipment,
  sellItem,
  upgradeEquipment
} from "../game/GameState";
import type { EquipmentId, ItemId } from "../game/types";

type ShopTab = "buy" | "sell" | "upgrade";
type ShopKind = "item" | "equipment";
type TradeEntry = { kind: "item"; id: ItemId } | { kind: "equipment"; id: EquipmentId };
interface ShopPayload {
  shopKind?: ShopKind;
  buyableEquipmentIds?: EquipmentId[];
}

// The item shop has nothing to upgrade, so it only ever gets buy/sell.
const ALL_TABS: ShopTab[] = ["buy", "sell", "upgrade"];
const TAB_LABELS: Record<ShopTab, string> = {
  buy: "買う",
  sell: "売る",
  upgrade: "強化"
};

export class ShopScene extends Phaser.Scene {
  private shopKind: ShopKind = "item";
  private buyableEquipmentIds?: EquipmentId[];
  private activeTab: ShopTab = "buy";
  private selectedItemIndex = 0;
  private tabButtons: Partial<Record<ShopTab, Phaser.GameObjects.Text>> = {};
  private contentObjects: Phaser.GameObjects.GameObject[] = [];
  private messageText?: Phaser.GameObjects.Text;
  private goldText?: Phaser.GameObjects.Text;

  constructor() {
    super("ShopScene");
  }

  create(payload?: ShopPayload): void {
    this.shopKind = payload?.shopKind ?? "item";
    this.buyableEquipmentIds = payload?.buyableEquipmentIds;
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
    this.add
      .text(154, 120, this.shopKind === "equipment" ? "装備屋" : "道具屋", this.textStyle(25, "#f6e4a4"))
      .setDepth(102);

    this.getTabs().forEach((tab, index) => {
      this.createTabButton(tab, 154 + index * 122, 176);
    });
    this.createCloseButton();
    // Room for a 3rd ("upgrade") tab pushed this out of the tab row (where
    // it used to collide with a wide tab strip) and up next to the title.
    this.goldText = this.add.text(420, 124, "", this.textStyle(18, "#f4df7e")).setDepth(102);
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
    this.clampSelectedItemIndex();
    this.setMessage("");
    this.renderContent();
  }

  private renderContent(): void {
    this.clearContent();
    this.updateTabs();
    this.goldText?.setText(`G ${getSave().gold}`);
    const tradeEntries = this.getTradeEntries();
    this.clampSelectedItemIndex();
    const { start, visible } = this.getVisibleTradeEntries(tradeEntries);

    visible.forEach((entry, visibleIndex) => {
      const index = start + visibleIndex;
      const selected = index === this.selectedItemIndex;
      const price = this.getTradePrice(entry);
      const canTrade = this.canTradeSelected(index);
      const y = 214 + visibleIndex * 34;
      const row = this.add
        .rectangle(388, y + 13, 468, 31, selected ? 0x263442 : 0x111a24, selected ? 0.95 : 0.58)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xd8bc72 : 0x34475a, selected ? 0.9 : 0.45)
        .setDepth(101)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.selectItem(index));
      this.addContent(row);
      this.addContent(
        this.add.text(164, y, selected ? ">" : "", this.textStyle(18, "#f6e4a4")).setDepth(102)
      );
      this.addContent(
        this.add.text(190, y, this.getTradeName(entry), this.textStyle(16, "#fff4cf")).setDepth(102)
      );
      this.addContent(
        this.add.text(300, y, this.getTradeRarityLabel(entry), this.textStyle(14, "#f4df7e")).setDepth(102)
      );
      this.addContent(
        this.add.text(340, y, `${price}G`, this.textStyle(16, canTrade ? "#f4df7e" : "#748393")).setDepth(102)
      );
      this.addContent(
        this.add.text(410, y, this.getTradeCountLabel(entry), this.textStyle(15, "#9fb4c6")).setDepth(102)
      );
      this.addContent(
        this.add.text(492, y, this.getTradeDescription(entry), this.textStyle(12, "#9fb4c6")).setDepth(102)
      );
    });

    const selectedEntry = tradeEntries[this.selectedItemIndex];
    const selectedCanTrade = this.canTradeSelected(this.selectedItemIndex);
    const actionLabel = this.activeTab === "buy" ? "買う" : this.activeTab === "upgrade" ? "強化する" : "売る";
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
        .text(154, 416, this.getSelectedInfoLine(selectedEntry), this.textStyle(15, "#f4df7e"))
        .setDepth(102)
    );

    this.getComparisonLines(selectedEntry).forEach((line, index) => {
      this.addContent(
        this.add.text(154, 440 + index * 18, line, this.textStyle(14, "#9fb4c6")).setDepth(102)
      );
    });
  }

  private getSelectedInfoLine(entry: TradeEntry): string {
    const name = this.getTradeName(entry);
    const rarity = this.getTradeRarityLabel(entry);
    if (this.activeTab === "upgrade" && entry.kind === "equipment") {
      const level = getEquipmentUpgradeLevel(entry.id);
      const atMax = level >= MAX_EQUIPMENT_UPGRADE_LEVEL;
      return `${name} ${rarity}  現在Lv${level}/${MAX_EQUIPMENT_UPGRADE_LEVEL}  次の強化 ${atMax ? "-" : `${getEquipmentUpgradeCost(entry.id, level)}G`}`;
    }
    return `${name} ${rarity}  買値 ${this.getTradeBuyPriceLabel(entry)}  売値 ${this.getTradeSellPrice(entry)}G`;
  }

  private getComparisonLines(entry: TradeEntry): string[] {
    if (entry.kind !== "equipment") {
      return [];
    }

    if (this.activeTab === "upgrade") {
      const level = getEquipmentUpgradeLevel(entry.id);
      if (level >= MAX_EQUIPMENT_UPGRADE_LEVEL) {
        return ["これ以上は強化できない。"];
      }
      const delta = getEquipmentStatDelta(entry.id, entry.id, level, level + 1);
      return [`次の強化(+${level + 1})での変化: ${delta}`];
    }

    if (this.activeTab !== "buy") {
      return [];
    }

    const slot = previewEquipmentSlot(entry.id);
    if (!slot) {
      return [];
    }

    const lines: string[] = [this.describeEquipmentUpgrade("自分", getEquippedEquipment(slot), entry.id)];
    COMPANION_ORDER.forEach((id) => {
      if (hasCompanion(id)) {
        lines.push(this.describeEquipmentUpgrade(COMPANIONS[id].name, getCompanionEquippedEquipment(id, slot), entry.id));
      }
    });
    return lines;
  }

  private describeEquipmentUpgrade(
    owner: string,
    currentId: EquipmentId | undefined,
    candidateId: EquipmentId
  ): string {
    const currentName = currentId ? EQUIPMENT[currentId].name : "なし";
    const delta = getEquipmentStatDelta(
      currentId,
      candidateId,
      currentId ? getEquipmentUpgradeLevel(currentId) : 0,
      getEquipmentUpgradeLevel(candidateId)
    );
    return `${owner}: 装備中(${currentName})と比較 ${delta}`;
  }

  private selectItem(index: number): void {
    this.selectedItemIndex = Phaser.Math.Clamp(index, 0, this.getTradeEntries().length - 1);
    this.setMessage("");
    this.renderContent();
  }

  private tradeSelectedItem(): void {
    const entry = this.getTradeEntries()[this.selectedItemIndex];
    const name = this.getTradeName(entry);

    if (this.activeTab === "upgrade") {
      if (entry.kind !== "equipment") {
        return;
      }
      const result = upgradeEquipment(entry.id);
      if (!result.upgraded) {
        this.setMessage(this.getUpgradeFailureMessage(result.reason));
        return;
      }
      this.setMessage(`${EQUIPMENT[entry.id].name}を+${result.level}に強化した。(${result.cost}G)`);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.renderContent();
      return;
    }

    if (this.activeTab === "buy") {
      const result = entry.kind === "item" ? buyItem(entry.id) : buyEquipment(entry.id);
      if (!result.bought) {
        this.setMessage("ゴールドが足りない。");
        return;
      }
      this.setMessage(`${name}を${result.price}Gで買った。`);
      this.game.events.emit(GAME_EVENTS.stateChanged);
      this.renderContent();
      return;
    }

    const result = entry.kind === "item" ? sellItem(entry.id) : sellEquipment(entry.id);
    if (!result.sold) {
      this.setMessage(`${name}を持っていない。`);
      return;
    }
    this.setMessage(`${name}を${result.price}Gで売った。`);
    this.game.events.emit(GAME_EVENTS.stateChanged);
    this.renderContent();
  }

  private getUpgradeFailureMessage(reason?: string): string {
    if (reason === "not-owned") {
      return "所持していない装備は強化できない。";
    }
    if (reason === "max-level") {
      return "これ以上は強化できない。";
    }
    if (reason === "not-enough-gold") {
      return "ゴールドが足りない。";
    }
    return "強化できなかった。";
  }

  private canTradeSelected(index: number): boolean {
    const entry = this.getTradeEntries()[index];
    if (this.activeTab === "upgrade") {
      if (entry.kind !== "equipment") {
        return false;
      }
      const level = getEquipmentUpgradeLevel(entry.id);
      return (
        level < MAX_EQUIPMENT_UPGRADE_LEVEL &&
        isEquipmentOwnedAnywhere(entry.id) &&
        getSave().gold >= getEquipmentUpgradeCost(entry.id, level)
      );
    }
    if (this.activeTab === "buy") {
      return this.isTradeBuyable(entry) && getSave().gold >= this.getTradePrice(entry);
    }
    return this.getTradeCount(entry) > 0;
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

  private getTabs(): ShopTab[] {
    return this.shopKind === "equipment" ? ALL_TABS : ALL_TABS.filter((tab) => tab !== "upgrade");
  }

  private moveTab(direction: number): void {
    const tabs = this.getTabs();
    const currentIndex = tabs.indexOf(this.activeTab);
    const nextIndex = Phaser.Math.Wrap(currentIndex + direction, 0, tabs.length);
    this.selectTab(tabs[nextIndex]);
  }

  private moveSelectedItem(direction: number): void {
    this.selectedItemIndex = Phaser.Math.Wrap(
      this.selectedItemIndex + direction,
      0,
      this.getTradeEntries().length
    );
    this.setMessage("");
    this.renderContent();
  }

  private getTradeEntries(): TradeEntry[] {
    if (this.shopKind === "equipment") {
      const equipmentIds =
        this.activeTab === "buy" ? this.buyableEquipmentIds ?? EQUIPMENT_SHOP_ORDER : EQUIPMENT_ORDER;
      return equipmentIds.map((id) => ({ kind: "equipment", id }));
    }

    const itemIds = this.activeTab === "buy" ? SHOP_BUY_ITEM_ORDER : ITEM_ORDER;
    return itemIds.map((id) => ({ kind: "item", id }));
  }

  private getTradeCountLabel(entry: TradeEntry): string {
    if (this.activeTab === "upgrade" && entry.kind === "equipment") {
      return `Lv${getEquipmentUpgradeLevel(entry.id)}/${MAX_EQUIPMENT_UPGRADE_LEVEL}`;
    }
    return `所持 x${this.getTradeCount(entry)}`;
  }

  private getVisibleTradeEntries(tradeEntries: TradeEntry[]): {
    start: number;
    visible: TradeEntry[];
  } {
    const visibleCount = 6;
    const start = Phaser.Math.Clamp(
      this.selectedItemIndex - Math.floor(visibleCount / 2),
      0,
      Math.max(0, tradeEntries.length - visibleCount)
    );
    return {
      start,
      visible: tradeEntries.slice(start, start + visibleCount)
    };
  }

  private getTradeName(entry: TradeEntry): string {
    if (entry.kind === "item") {
      return ITEMS[entry.id].name;
    }
    // The upgrade level is global to the equipment id (see GameState's
    // equipmentUpgrades), so the "+N" suffix applies everywhere this id is
    // listed — buy/sell included — not just on the upgrade tab.
    const label = getEquipmentUpgradeLabel(getEquipmentUpgradeLevel(entry.id));
    return label ? `${EQUIPMENT[entry.id].name} ${label}` : EQUIPMENT[entry.id].name;
  }

  private getTradeRarityLabel(entry: TradeEntry): string {
    return entry.kind === "item" ? getItemRarityLabel(entry.id) : getEquipmentRarityLabel(entry.id);
  }

  private getTradeDescription(entry: TradeEntry): string {
    if (entry.kind === "item") {
      return ITEMS[entry.id].description;
    }

    const category = EQUIPMENT_CATEGORY_LABELS[EQUIPMENT[entry.id].category];
    const summary = getEquipmentStatSummary(entry.id, getEquipmentUpgradeLevel(entry.id));
    return `${category} ${summary}`;
  }

  private getTradeCount(entry: TradeEntry): number {
    return entry.kind === "item" ? getItemCount(entry.id) : getEquipmentCount(entry.id);
  }

  private getTradePrice(entry: TradeEntry): number {
    if (this.activeTab === "upgrade") {
      return entry.kind === "equipment" ? getEquipmentUpgradeCost(entry.id, getEquipmentUpgradeLevel(entry.id)) : 0;
    }
    if (this.activeTab === "buy") {
      return entry.kind === "item" ? getItemBuyPrice(entry.id) : getEquipmentBuyPrice(entry.id);
    }

    return this.getTradeSellPrice(entry);
  }

  private getTradeSellPrice(entry: TradeEntry): number {
    return entry.kind === "item" ? getItemSellPrice(entry.id) : getEquipmentSellPrice(entry.id);
  }

  private getTradeBuyPriceLabel(entry: TradeEntry): string {
    if (entry.kind === "item") {
      return isItemBuyable(entry.id) ? `${getItemBuyPrice(entry.id)}G` : "非売品";
    }

    return isEquipmentBuyable(entry.id) ? `${getEquipmentBuyPrice(entry.id)}G` : "非売品";
  }

  private isTradeBuyable(entry: TradeEntry): boolean {
    return entry.kind === "item" ? isItemBuyable(entry.id) : isEquipmentBuyable(entry.id);
  }

  private clampSelectedItemIndex(): void {
    this.selectedItemIndex = Phaser.Math.Clamp(
      this.selectedItemIndex,
      0,
      this.getTradeEntries().length - 1
    );
  }

  private updateTabs(): void {
    this.getTabs().forEach((tab) => {
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
