// Pure, isomorphic data for Luna's menu conversation. No GameState/localStorage
// dependency here so this can be safely imported from the Cloudflare Worker too.

export type LunaQuestStage =
  | "second-quest-complete"
  | "second-treasure-found"
  | "second-quest-active"
  | "casual";

export interface LunaQuestFlags {
  secondQuestComplete: boolean;
  secondTreasureFound: boolean;
  secondQuestAccepted: boolean;
  questComplete: boolean;
}

export function getLunaQuestStage(flags: LunaQuestFlags): LunaQuestStage {
  if (flags.secondQuestComplete) {
    return "second-quest-complete";
  }
  if (flags.secondTreasureFound) {
    return "second-treasure-found";
  }
  if (flags.secondQuestAccepted || flags.questComplete) {
    return "second-quest-active";
  }
  return "casual";
}

export function isLunaQuestStage(value: unknown): value is LunaQuestStage {
  return (
    value === "second-quest-complete" ||
    value === "second-treasure-found" ||
    value === "second-quest-active" ||
    value === "casual"
  );
}

export interface LunaStaticLine {
  id: string;
  text: string;
}

export const LUNA_CASUAL_LINES: LunaStaticLine[] = [
  { id: "casual-0", text: "ルナ: この村の空気、好きです。落ち着きますね。" },
  { id: "casual-1", text: "ルナ: あなたの剣の腕、旅を続けるうちにさまになってきましたね。" },
  { id: "casual-2", text: "ルナ: 洞窟の奥は冷えますから、無理はなさらずに。" },
  { id: "casual-3", text: "ルナ: こうして一緒に旅ができて、嬉しく思っています。" },
  { id: "casual-4", text: "ルナ: 少し休んでいきますか?私は平気ですよ。" },
  { id: "casual-5", text: "ルナ: 星の位置を見ていました。今夜は月が綺麗ですね。" },
  { id: "casual-6", text: "ルナ: 何か困ったことがあれば、遠慮なく言ってくださいね。" }
];

const STAGE_LINES: Record<Exclude<LunaQuestStage, "casual">, LunaStaticLine> = {
  "second-quest-complete": {
    id: "stage-second-quest-complete",
    text: "ルナ: 太陽石と月影石……二つの光が村を守っている。感慨深いですね。"
  },
  "second-treasure-found": {
    id: "stage-second-treasure-found",
    text: "ルナ: 月影石、ついに手に入れましたね。村長に見せてあげましょう。"
  },
  "second-quest-active": {
    id: "stage-second-quest-active",
    text: "ルナ: 黒曜の深層洞窟……村長の話では、太陽石の時よりも険しい道のりだとか。気を引き締めていきましょう。"
  }
};

export function getLunaStaticLinePool(stage: LunaQuestStage): LunaStaticLine[] {
  if (stage === "casual") {
    return LUNA_CASUAL_LINES;
  }
  return [STAGE_LINES[stage]];
}

export function getLunaLineForStage(stage: LunaQuestStage): string {
  if (stage === "casual") {
    return LUNA_CASUAL_LINES[Math.floor(Math.random() * LUNA_CASUAL_LINES.length)].text;
  }
  return STAGE_LINES[stage].text;
}

export function describeLunaStage(stage: LunaQuestStage): string {
  switch (stage) {
    case "second-quest-complete":
      return "月影石を村長に届け終え、太陽石と月影石がそろった。村を守る結界は完成し、当面の脅威は去った。";
    case "second-treasure-found":
      return "深い洞窟の奥で月影石を手に入れたばかりで、これから村長に報告しに戻るところ。";
    case "second-quest-active":
      return "村長から、太陽石の時よりも危険な黒曜の深層洞窟へ向かうよう言われたばかり。";
    default:
      return "特に大きな出来事は起きていない。村や草原を勇者と一緒に旅している、何気ない一時。";
  }
}
