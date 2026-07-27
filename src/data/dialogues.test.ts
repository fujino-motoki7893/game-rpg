import { describe, expect, it, beforeEach } from "vitest";
import { getJournalEntries, getObjective } from "./dialogues";
import { markFlag, resetSave } from "../game/GameState";

describe("getJournalEntries", () => {
  beforeEach(() => {
    resetSave();
  });

  it("has only the current objective on a fresh save", () => {
    const entries = getJournalEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ text: getObjective(), current: true });
  });

  it("appends completed milestones in chronological order as flags are set", () => {
    markFlag("questAccepted");
    markFlag("treasureFound");

    const entries = getJournalEntries();
    expect(entries.map((e) => e.current)).toEqual([false, false, true]);
    expect(entries[0].text).toContain("頼まれた");
    expect(entries[1].text).toContain("太陽石を取り戻した");
    expect(entries[2].current).toBe(true);
    expect(entries[2].text).toBe(getObjective());
  });

  it("only the last entry is ever marked current", () => {
    markFlag("questAccepted");
    markFlag("treasureFound");
    markFlag("questComplete");
    markFlag("secondQuestAccepted");

    const entries = getJournalEntries();
    entries.slice(0, -1).forEach((entry) => expect(entry.current).toBe(false));
    expect(entries[entries.length - 1].current).toBe(true);
  });
});
