import { hasFlag } from "../game/GameState";

export function getNpcDialogue(npcId: string): string[] {
  if (npcId === "elder") {
    if (hasFlag("questComplete")) {
      return [
        "Elder Rowan: Stonebrook is safe again.",
        "Elder Rowan: Keep the road in your heart, young hero."
      ];
    }

    if (hasFlag("treasureFound")) {
      return [
        "Elder Rowan: The Sunstone is back in our hands.",
        "Elder Rowan: Take this gold and our thanks.",
        "The village bell rings clear across the valley."
      ];
    }

    if (hasFlag("questAccepted")) {
      return [
        "Elder Rowan: The cave lies beyond the moonlit field.",
        "Elder Rowan: Bring back the Sunstone before the shadows stir."
      ];
    }

    return [
      "Elder Rowan: A relic called the Sunstone sleeps in Emberfall Cave.",
      "Elder Rowan: Will you retrieve it for Stonebrook?",
      "Quest started: Find the Sunstone."
    ];
  }

  if (npcId === "healer") {
    return [
      "Mira: Let me mend your wounds.",
      "Mira: I tucked an extra potion into your pack."
    ];
  }

  return ["There is no answer."];
}

export function getObjective(): string {
  if (hasFlag("questComplete")) {
    return "Quest complete";
  }

  if (hasFlag("treasureFound")) {
    return "Return to Elder Rowan";
  }

  if (hasFlag("questAccepted")) {
    return "Recover the Sunstone";
  }

  return "Speak with Elder Rowan";
}
