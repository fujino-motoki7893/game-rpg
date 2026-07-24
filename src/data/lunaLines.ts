// Pure, isomorphic data for Luna's menu conversation. No GameState/localStorage
// dependency here so this can be safely imported from the Cloudflare Worker too.

export type LunaQuestStage =
  | "fourth-quest-complete"
  | "mist-sovereign-defeated"
  | "fourth-quest-active"
  | "third-quest-complete"
  | "final-beast-defeated"
  | "third-quest-active"
  | "second-quest-complete"
  | "second-treasure-found"
  | "second-quest-active"
  | "casual";

export interface LunaQuestFlags {
  fourthQuestComplete: boolean;
  mistSovereignDefeated: boolean;
  fourthQuestAccepted: boolean;
  thirdQuestComplete: boolean;
  finalBeastDefeated: boolean;
  thirdQuestAccepted: boolean;
  secondQuestComplete: boolean;
  secondTreasureFound: boolean;
  secondQuestAccepted: boolean;
  questComplete: boolean;
}

export function getLunaQuestStage(flags: LunaQuestFlags): LunaQuestStage {
  if (flags.fourthQuestComplete) {
    return "fourth-quest-complete";
  }
  if (flags.mistSovereignDefeated) {
    return "mist-sovereign-defeated";
  }
  if (flags.fourthQuestAccepted) {
    return "fourth-quest-active";
  }
  if (flags.thirdQuestComplete) {
    return "third-quest-complete";
  }
  if (flags.finalBeastDefeated) {
    return "final-beast-defeated";
  }
  if (flags.thirdQuestAccepted) {
    return "third-quest-active";
  }
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
    value === "fourth-quest-complete" ||
    value === "mist-sovereign-defeated" ||
    value === "fourth-quest-active" ||
    value === "third-quest-complete" ||
    value === "final-beast-defeated" ||
    value === "third-quest-active" ||
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
  "fourth-quest-complete": {
    id: "stage-fourth-quest-complete",
    text: "ルナ: 霧隠れの里にも、静けさが戻りましたね。ここまで一緒に来られて、良かったです。"
  },
  "mist-sovereign-defeated": {
    id: "stage-mist-sovereign-defeated",
    text: "ルナ: 深霧の魔王……まさか、こんなところにまだ脅威が眠っていたなんて。里の長老に報告しましょう。"
  },
  "fourth-quest-active": {
    id: "stage-fourth-quest-active",
    text: "ルナ: 霧の向こうに隠れていた里があったのですね。深霧の魔王、油断せずに挑みましょう。"
  },
  "third-quest-complete": {
    id: "stage-third-quest-complete",
    text: "ルナ: 谷には静けさが戻りましたね。でも、草原の奥に霧に隠れた里があるとか。私たちの冒険は、まだ始まったばかりです。"
  },
  "final-beast-defeated": {
    id: "stage-final-beast-defeated",
    text: "ルナ: 討ち果たしましたね……。あの日、故郷を覆った影と同じ気配がしました。今度は、間に合いました。"
  },
  "third-quest-active": {
    id: "stage-third-quest-active",
    text: "ルナ: 月蝕の魔獣……その名を聞いて、胸がざわつきます。昔、故郷の村も同じ影に呑まれかけましたから。"
  },
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
    case "fourth-quest-complete":
      return "霧隠れの里で深霧の魔王を討伐し、長老への報告も終えた。隠れ里に静けさが戻り、旅の最後の山場を越えた安堵に包まれている。";
    case "mist-sovereign-defeated":
      return "霧隠れの里の奥、坑道の最深部で深霧の魔王をちょうど討ち果たしたところ。まだ知られざる脅威が残っていたことに、ルナは驚きと安堵の入り混じった様子。";
    case "fourth-quest-active":
      return "月蝕の魔獣を倒した後に見つかった、霧に隠れた里から、深霧の魔王討伐を頼まれたばかり。これから坑道の奥へ向かうところ。";
    case "third-quest-complete":
      return "月蝕の魔獣を討伐し、村長への報告も終えた。谷には穏やかな夜が戻ったが、草原の奥に霧隠れの里という新たな行き先が見えてきたところ。旅はここで終わりではなく、新しい章の始まりだとルナは感じている。";
    case "final-beast-defeated":
      return "月蝕の魔獣をちょうど討ち果たしたところ。ルナは自分の故郷にまつわる古い傷に触れており、感慨深い様子。";
    case "third-quest-active":
      return "村長から、月蝕の魔獣という新たな脅威の話を聞いたばかりで、これから討伐に向かうところ。ルナにとって、その名は昔の故郷の記憶と重なる、思い入れのある脅威。";
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
