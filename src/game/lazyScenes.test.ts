import { describe, expect, it, vi } from "vitest";
import { launchLazyScene } from "./lazyScenes";

class FakeSceneA {}
class FakeSceneB {}

vi.mock("../scenes/MenuScene", () => ({ MenuScene: FakeSceneA }));
vi.mock("../scenes/ShopScene", () => ({ ShopScene: FakeSceneB }));

function createFakeScenePlugin() {
  const keys: Record<string, unknown> = {};
  return {
    manager: { keys },
    add: vi.fn((key: string, ctor: unknown) => {
      keys[key] = new (ctor as new () => unknown)();
    }),
    launch: vi.fn()
  };
}

describe("launchLazyScene", () => {
  it("registers a scene on first use and launches it", async () => {
    const scenePlugin = createFakeScenePlugin();

    await launchLazyScene(scenePlugin as any, "MenuScene");

    expect(scenePlugin.add).toHaveBeenCalledTimes(1);
    expect(scenePlugin.add).toHaveBeenCalledWith("MenuScene", FakeSceneA);
    expect(scenePlugin.launch).toHaveBeenCalledWith("MenuScene", undefined);
    expect(scenePlugin.manager.keys.MenuScene).toBeInstanceOf(FakeSceneA);
  });

  it("does not re-register an already-registered scene", async () => {
    const scenePlugin = createFakeScenePlugin();

    await launchLazyScene(scenePlugin as any, "MenuScene");
    await launchLazyScene(scenePlugin as any, "MenuScene", { foo: "bar" });

    expect(scenePlugin.add).toHaveBeenCalledTimes(1);
    expect(scenePlugin.launch).toHaveBeenCalledTimes(2);
    expect(scenePlugin.launch).toHaveBeenLastCalledWith("MenuScene", { foo: "bar" });
  });

  it("tracks registration independently per scene key", async () => {
    const scenePlugin = createFakeScenePlugin();

    await launchLazyScene(scenePlugin as any, "MenuScene");
    await launchLazyScene(scenePlugin as any, "ShopScene", { shopKind: "item" });

    expect(scenePlugin.add).toHaveBeenCalledTimes(2);
    expect(scenePlugin.manager.keys.ShopScene).toBeInstanceOf(FakeSceneB);
  });
});
