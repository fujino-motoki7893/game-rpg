import type Phaser from "phaser";

export type LazySceneKey = "BattleScene" | "MenuScene" | "ShopScene" | "EndingScene";

type SceneCtor = new (...args: any[]) => Phaser.Scene;

// These four scenes are only ever needed once the player reaches a specific
// moment (first battle, opening the menu, entering a shop, beating the
// final boss) rather than at boot, unlike BootScene/WorldScene/UIScene which
// main.ts registers eagerly. Loading them via import() splits each into its
// own chunk and keeps them out of the initial bundle; launchLazyScene()
// registers a scene with the Scene Manager on first use only.
const LOADERS: Record<LazySceneKey, () => Promise<SceneCtor>> = {
  BattleScene: () => import("../scenes/BattleScene").then((m) => m.BattleScene),
  MenuScene: () => import("../scenes/MenuScene").then((m) => m.MenuScene),
  ShopScene: () => import("../scenes/ShopScene").then((m) => m.ShopScene),
  EndingScene: () => import("../scenes/EndingScene").then((m) => m.EndingScene)
};

export async function launchLazyScene(
  scenePlugin: Phaser.Scenes.ScenePlugin,
  key: LazySceneKey,
  data?: object
): Promise<void> {
  if (!(key in scenePlugin.manager.keys)) {
    const SceneClass = await LOADERS[key]();
    // Re-check after the await: a second caller could have raced us while
    // the chunk was loading and already registered the scene.
    if (!(key in scenePlugin.manager.keys)) {
      scenePlugin.add(key, SceneClass);
    }
  }

  scenePlugin.launch(key, data);
}
