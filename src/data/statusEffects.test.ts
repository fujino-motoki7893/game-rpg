import { describe, expect, it } from "vitest";
import {
  getStatusEffectIcon,
  getStatusEffectName,
  getStatusTickDamage,
  isDamageTickStatus,
  isStunStatus
} from "./statusEffects";

describe("status effect classification", () => {
  it("classifies burn and poison as damage-ticking, stun as not", () => {
    expect(isDamageTickStatus("burn")).toBe(true);
    expect(isDamageTickStatus("poison")).toBe(true);
    expect(isDamageTickStatus("stun")).toBe(false);
  });

  it("classifies stun as a stun, burn/poison as not", () => {
    expect(isStunStatus("stun")).toBe(true);
    expect(isStunStatus("burn")).toBe(false);
    expect(isStunStatus("poison")).toBe(false);
  });

  it("gives every status type a name and icon", () => {
    for (const type of ["burn", "poison", "stun"] as const) {
      expect(getStatusEffectName(type)).toBeTruthy();
      expect(getStatusEffectIcon(type)).toBeTruthy();
    }
  });
});

describe("getStatusTickDamage", () => {
  it("scales with max HP", () => {
    expect(getStatusTickDamage(100)).toBe(8);
    expect(getStatusTickDamage(200)).toBe(16);
  });

  it("never rounds down to zero, even for very low max HP", () => {
    expect(getStatusTickDamage(1)).toBeGreaterThanOrEqual(1);
    expect(getStatusTickDamage(5)).toBeGreaterThanOrEqual(1);
  });
});
