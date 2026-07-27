import { describe, expect, it } from "vitest";
import { decideCompanionAction } from "./companions";
import { getEnemySkills } from "./enemySkills";

describe("decideCompanionAction reused as enemy AI", () => {
  const context = { playerHp: 30, playerMaxHp: 30 };

  it("picks the strongest affordable attack skill when MP allows it", () => {
    const skills = getEnemySkills("guardian"); // [basicAttack(0mp), scorchingStrike(6mp)]
    const action = decideCompanionAction(skills, 6, context);
    expect(action.kind).toBe("attack");
    expect(action.skill.id).toBe("scorchingStrike");
  });

  it("falls back to the free basic attack once MP can't afford the signature skill", () => {
    const skills = getEnemySkills("guardian");
    const action = decideCompanionAction(skills, 5, context);
    expect(action.skill.id).toBe("basicAttack");
    expect(action.skill.mpCost).toBe(0);
  });

  it("returns only the basic attack for enemies with no signature skill table", () => {
    const skills = getEnemySkills("slime");
    expect(skills).toHaveLength(1);
    const action = decideCompanionAction(skills, 0, context);
    expect(action.skill.id).toBe("basicAttack");
  });

  it("every enemy skill table's cheapest entry costs 0 MP (always affordable fallback)", () => {
    for (const key of ["slime", "goblin", "orc", "direWolf", "darkMage", "stoneGolem", "guardian", "deepGuardian", "eclipseBeast", "mistSovereign"]) {
      const skills = getEnemySkills(key);
      expect(Math.min(...skills.map((s) => s.mpCost))).toBe(0);
    }
  });
});
