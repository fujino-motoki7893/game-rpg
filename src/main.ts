import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./scenes/BootScene";
import { UIScene } from "./scenes/UIScene";
import { WorldScene } from "./scenes/WorldScene";

// BattleScene/MenuScene/ShopScene/EndingScene are not registered here — each
// is only needed once the player reaches a specific moment (first battle,
// opening the menu, entering a shop, beating the final boss), so
// launchLazyScene() (see game/lazyScenes.ts) code-splits and registers them
// with the Scene Manager on first use instead of bundling them upfront.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#101820",
  width: 800,
  height: 640,
  pixelArt: true,
  roundPixels: true,
  scene: [BootScene, WorldScene, UIScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
