export type StatusEffectType = "burn" | "poison" | "stun";

/**
 * Attached to a damage/attack skill's effect: a chance to additionally
 * inflict a status effect on whatever the hit lands on, on top of the
 * direct damage. Not every skill needs one — this is always optional.
 */
export interface StatusInflict {
  type: StatusEffectType;
  /** 0-1 chance to actually apply, rolled once per hit that lands. */
  chance: number;
  /** How many of the afflicted actor's own upcoming turns it lasts. */
  duration: number;
}

/**
 * Battle-runtime state for one active effect on one combatant. This only
 * ever lives inside BattleScene's in-memory map — it's never persisted to
 * GameState, so effects never carry over between separate battles.
 */
export interface ActiveStatusEffect {
  type: StatusEffectType;
  remainingTurns: number;
}

const STATUS_NAMES: Record<StatusEffectType, string> = {
  burn: "火傷",
  poison: "毒",
  stun: "しびれ"
};

const STATUS_ICONS: Record<StatusEffectType, string> = {
  burn: "🔥",
  poison: "☠",
  stun: "⚡"
};

export function getStatusEffectName(type: StatusEffectType): string {
  return STATUS_NAMES[type];
}

export function getStatusEffectIcon(type: StatusEffectType): string {
  return STATUS_ICONS[type];
}

/** Burn and poison tick damage each turn; stun instead skips the turn. */
export function isDamageTickStatus(type: StatusEffectType): boolean {
  return type === "burn" || type === "poison";
}

export function isStunStatus(type: StatusEffectType): boolean {
  return type === "stun";
}

// Shared by every damage-ticking status so a burned/poisoned target takes
// meaningful chip damage without needing per-enemy tuning.
const STATUS_TICK_DAMAGE_RATIO = 0.08;

export function getStatusTickDamage(maxHp: number): number {
  return Math.max(1, Math.round(maxHp * STATUS_TICK_DAMAGE_RATIO));
}
