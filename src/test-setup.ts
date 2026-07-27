// vitest runs tests under Node, which has no localStorage — GameState.ts
// reads/writes it directly (this is a browser game, not built with a DOM
// abstraction layer). A minimal in-memory polyfill is enough for tests
// that touch save state (e.g. resetSave/markFlag) without pulling in a
// full jsdom environment just for this one API.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  const localStoragePolyfill: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  };
  globalThis.localStorage = localStoragePolyfill;
}
