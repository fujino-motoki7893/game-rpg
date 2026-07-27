import { hasFlag, markFlag } from "../game/GameState";
import { getLunaLineForStage, getLunaQuestStage, getLunaStaticLinePool } from "./lunaLines";
import type { LunaQuestStage } from "./lunaLines";

const LUNA_SEEN_FLAG_PREFIX = "luna-line-seen:";

export function getNpcDialogue(npcId: string): string[] {
  if (npcId === "elder") {
    if (hasFlag("thirdQuestComplete")) {
      return [
        "村長ローアン: おぬしのおかげで、この谷に静かな夜が戻った。",
        "村長ローアン: これからも、この村を見守っておくれ。"
      ];
    }

    if (hasFlag("finalBeastDefeated")) {
      return [
        "村長ローアン: 月蝕の魔獣は討ち果たしたのだったな……!",
        "村長ローアン: 詳しい話を聞かせてくれ。"
      ];
    }

    if (hasFlag("thirdQuestAccepted")) {
      return [
        "村長ローアン: 月蝕の魔獣は、草原の奥に開いた新たな坑道に潜んでいるという。",
        "村長ローアン: くれぐれも、油断はしないでくれ。"
      ];
    }

    if (hasFlag("secondQuestComplete")) {
      return [
        "村長ローアン: 太陽石と月影石がそろい、谷の結界は強くなった。",
        "村長ローアン: 若き勇者よ、広がった世界をゆっくり見て回っておくれ。"
      ];
    }

    if (hasFlag("secondTreasureFound")) {
      return [
        "村長ローアン: 月影石まで持ち帰ってくれたのか。",
        "村長ローアン: 深き洞窟を越えた勇気に、村の皆が胸を熱くしている。"
      ];
    }

    if (hasFlag("secondQuestAccepted") || hasFlag("questComplete")) {
      return [
        "村長ローアン: 草原の東に、黒曜の深層洞窟へ続く道が開いた。",
        "村長ローアン: そこに眠る月影石があれば、村の結界はさらに強くなる。"
      ];
    }

    if (hasFlag("treasureFound")) {
      return [
        "村長ローアン: 太陽石を取り戻してくれたのだな。",
        "村長ローアン: この金貨と、村の感謝を受け取っておくれ。",
        "村の鐘が谷いっぱいに澄んだ音を響かせた。"
      ];
    }

    if (hasFlag("questAccepted")) {
      return [
        "村長ローアン: 洞窟は月明かりの草原の先にある。",
        "村長ローアン: 影が濃くなる前に、太陽石を持ち帰っておくれ。"
      ];
    }

    return [
      "村長ローアン: エンバーフォール洞窟には、太陽石という古い秘宝が眠っている。",
      "村長ローアン: ストーンブルックのために、取り戻してくれるか？",
      "クエスト開始: 太陽石を探す"
    ];
  }

  if (npcId === "shopkeeper") {
    if (hasFlag("carriageObtained")) {
      return ["道具屋ニコ: 馬車を借り受けたんだって？さすがだね。旅の荷物なら任せておくれ。"];
    }

    if (hasFlag("thirdQuestComplete")) {
      return ["道具屋ニコ: 谷に静けさが戻ったなあ。おかげでこっちも仕入れに集中できるよ。"];
    }

    if (hasFlag("treasureFound")) {
      return ["道具屋ニコ: 太陽石を取り戻したんだって？大したもんだ。"];
    }

    if (hasFlag("questAccepted")) {
      return ["道具屋ニコ: 洞窟に行くなら、薬草くらいは持っていきな。"];
    }

    return ["道具屋ニコ: 旅の準備なら、うちに任せて。"];
  }

  if (npcId === "equipmentShopkeeper") {
    if (hasFlag("fourthQuestComplete")) {
      return ["装備屋ガロ: 深霧の魔王まで倒したのか。お前の装備、もううちの店じゃ物足りないんじゃないか？"];
    }

    if (hasFlag("finalBeastDefeated")) {
      return ["装備屋ガロ: 月蝕の魔獣を討ったって聞いたぜ。いい面構えになったじゃないか。"];
    }

    if (hasFlag("secondTreasureFound")) {
      return ["装備屋ガロ: 月影石まで持ち帰るとはな。装備も見直していくか？"];
    }

    if (hasFlag("questAccepted")) {
      return ["装備屋ガロ: 洞窟に潜るなら、防具は妥協するな。"];
    }

    return ["装備屋ガロ: いい防具を揃えてるぜ、見ていきな。"];
  }

  if (npcId === "hiddenElder") {
    if (hasFlag("fourthQuestComplete")) {
      return ["隠れ里の長老: この里に平穏を取り戻してくれて、本当にありがとう。"];
    }

    if (hasFlag("mistSovereignDefeated")) {
      return [
        "隠れ里の長老: 深霧の魔王を討ち果たしたのだったな……!",
        "隠れ里の長老: 詳しい話を聞かせてくれ。"
      ];
    }

    if (hasFlag("fourthQuestAccepted")) {
      return [
        "隠れ里の長老: 深霧の魔王は、里の奥の坑道に眠っているという。",
        "隠れ里の長老: くれぐれも油断はしないでくれ。"
      ];
    }

    return ["隠れ里の長老: ……この里へようこそ。"];
  }

  return ["返事はない。"];
}

export function getCurrentLunaStage(): LunaQuestStage {
  return getLunaQuestStage({
    fourthQuestComplete: hasFlag("fourthQuestComplete"),
    mistSovereignDefeated: hasFlag("mistSovereignDefeated"),
    fourthQuestAccepted: hasFlag("fourthQuestAccepted"),
    thirdQuestComplete: hasFlag("thirdQuestComplete"),
    finalBeastDefeated: hasFlag("finalBeastDefeated"),
    thirdQuestAccepted: hasFlag("thirdQuestAccepted"),
    secondQuestComplete: hasFlag("secondQuestComplete"),
    secondTreasureFound: hasFlag("secondTreasureFound"),
    secondQuestAccepted: hasFlag("secondQuestAccepted"),
    questComplete: hasFlag("questComplete")
  });
}

export function getLunaLine(): string {
  return getLunaLineForStage(getCurrentLunaStage());
}

/**
 * Returns the next not-yet-seen static line for the given stage, marking it
 * seen as a side effect. Returns undefined once every static line for this
 * stage has already been shown at least once (across the whole save), which
 * signals the caller to fall back to AI generation instead.
 */
export function getNextStaticLunaLine(stage: LunaQuestStage): string | undefined {
  const unseen = getLunaStaticLinePool(stage).filter(
    (line) => !hasFlag(`${LUNA_SEEN_FLAG_PREFIX}${line.id}`)
  );
  if (unseen.length === 0) {
    return undefined;
  }

  const chosen = unseen[Math.floor(Math.random() * unseen.length)];
  markFlag(`${LUNA_SEEN_FLAG_PREFIX}${chosen.id}`);
  return chosen.text;
}

export async function fetchLunaLine(stage: LunaQuestStage): Promise<string> {
  const response = await fetch("/api/luna-line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage }),
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error(`Luna line API returned ${response.status}`);
  }

  const payload = (await response.json()) as { line?: unknown };
  const line = payload.line;
  if (typeof line !== "string" || !line.trim() || line.length > 160) {
    throw new Error("Luna line API returned an invalid line");
  }

  return line.trim();
}

export interface JournalEntry {
  text: string;
  /** The single active step, shown distinctly from completed history. */
  current: boolean;
}

// Chronological order matches getObjective()'s flag ladder below (each
// completed step there becomes a past-tense record here) — purely derived
// from flags already set elsewhere, no separate journal state to maintain.
const JOURNAL_MILESTONES: { flag: string; text: string }[] = [
  { flag: "questAccepted", text: "村長ローアンから、太陽石を取り戻してほしいと頼まれた。" },
  { flag: "treasureFound", text: "エンバーフォール洞窟で太陽石を取り戻した。" },
  { flag: "questComplete", text: "太陽石を村長ローアンに届けた。" },
  { flag: "secondQuestAccepted", text: "黒曜の深層洞窟で月影石を探すことになった。" },
  { flag: "secondTreasureFound", text: "月影石を取り戻した。" },
  { flag: "secondQuestComplete", text: "月影石を届け、村の結界がさらに強まった。" },
  { flag: "thirdQuestAccepted", text: "草原の奥に現れた月蝕の魔獣の討伐を引き受けた。" },
  { flag: "finalBeastDefeated", text: "月蝕の魔獣を討ち果たした。" },
  { flag: "thirdQuestComplete", text: "村長ローアンに討伐を報告し、谷に静けさが戻った。" },
  { flag: "fourthQuestAccepted", text: "霧隠れの里で深霧の魔王の討伐を引き受けた。" },
  { flag: "mistSovereignDefeated", text: "深霧の魔王を討ち果たした。" },
  { flag: "carriageObtained", text: "礼として馬車を借り受けた。" },
  { flag: "fourthQuestComplete", text: "隠れ里の長老に討伐を報告し、里に平穏が戻った。" }
];

/** A read-only history of completed milestones (derived from the same
 * flags getObjective() reads) plus the current objective at the end. */
export function getJournalEntries(): JournalEntry[] {
  const entries: JournalEntry[] = JOURNAL_MILESTONES.filter((milestone) => hasFlag(milestone.flag)).map(
    (milestone) => ({ text: milestone.text, current: false })
  );
  entries.push({ text: getObjective(), current: true });
  return entries;
}

export function getObjective(): string {
  if (hasFlag("fourthQuestComplete")) {
    return "霧隠れの里に戻った静けさを見守る";
  }

  if (hasFlag("mistSovereignDefeated")) {
    return "隠れ里の長老に討伐を報告する";
  }

  if (hasFlag("fourthQuestAccepted")) {
    return "深霧の魔王を討伐する";
  }

  if (hasFlag("thirdQuestComplete")) {
    return "草原の奥に現れた霧隠れの里を訪ねる";
  }

  if (hasFlag("finalBeastDefeated")) {
    return "村長ローアンに討伐を報告する";
  }

  if (hasFlag("thirdQuestAccepted")) {
    return "月蝕の魔獣を討伐する";
  }

  if (hasFlag("secondQuestComplete")) {
    return "村を見守る";
  }

  if (hasFlag("secondTreasureFound")) {
    return "月影石を報告する";
  }

  if (hasFlag("secondQuestAccepted") || hasFlag("questComplete")) {
    return "新洞窟で月影石を探す";
  }

  if (hasFlag("treasureFound")) {
    return "村長ローアンに報告する";
  }

  if (hasFlag("questAccepted")) {
    return "太陽石を取り戻す";
  }

  return "村長ローアンと話す";
}
