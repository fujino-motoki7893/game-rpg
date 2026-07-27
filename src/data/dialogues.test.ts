import { describe, expect, it, beforeEach } from "vitest";
import { getCompanionChatStage, getJournalEntries, getNextStaticCompanionLine, getObjective } from "./dialogues";
import { hasFlag, markFlag, resetSave } from "../game/GameState";

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

describe("getCompanionChatStage", () => {
  beforeEach(() => {
    resetSave();
  });

  it("defaults both companions to their casual stage", () => {
    expect(getCompanionChatStage("luna")).toBe("casual");
    expect(getCompanionChatStage("geist")).toBe("casual");
  });

  it("advances geist's stage using his own shorter stage ladder", () => {
    markFlag("questAccepted");
    markFlag("treasureFound");
    markFlag("questComplete");
    expect(getCompanionChatStage("geist")).toBe("casual");
    expect(getCompanionChatStage("luna")).not.toBe("casual");

    markFlag("mistSovereignDefeated");
    expect(getCompanionChatStage("geist")).toBe("mist-sovereign-defeated");
  });
});

describe("getNextStaticCompanionLine", () => {
  beforeEach(() => {
    resetSave();
  });

  it("marks luna's seen-line flag using the pre-existing luna-line-seen: prefix for backward compatibility", () => {
    const line = getNextStaticCompanionLine("luna", "casual");
    expect(line).toBeDefined();

    let matched = false;
    for (let i = 0; i < 20; i += 1) {
      if (hasFlag(`luna-line-seen:casual-${i}`)) {
        matched = true;
        break;
      }
    }
    expect(matched).toBe(true);
  });

  it("gives geist his own geist-line-seen: namespace, separate from luna's", () => {
    getNextStaticCompanionLine("geist", "casual");

    let matched = false;
    for (let i = 0; i < 20; i += 1) {
      if (hasFlag(`geist-line-seen:casual-${i}`)) {
        matched = true;
        break;
      }
    }
    expect(matched).toBe(true);
  });

  it("returns undefined once every static line for a stage has been seen", () => {
    for (let i = 0; i < 20; i += 1) {
      const line = getNextStaticCompanionLine("geist", "mist-sovereign-defeated");
      if (line === undefined) {
        break;
      }
    }
    expect(getNextStaticCompanionLine("geist", "mist-sovereign-defeated")).toBeUndefined();
  });
});
