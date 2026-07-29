import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./scenes/BootScene";
import { UIScene } from "./scenes/UIScene";
import { WorldScene } from "./scenes/WorldScene";
import { initCloudSave } from "./game/GameState";

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

// Waited on before boot (rather than left to run in the background) so a
// cloud save restored for a fresh browser can't land after a scene has
// already read local state.
void initCloudSave().then(() => {
  new Phaser.Game(config);
});
