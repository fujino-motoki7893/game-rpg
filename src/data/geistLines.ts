// Pure, isomorphic data for Geist's menu conversation — mirrors lunaLines.ts's
// shape (stage type, static pools, describeStage) but not its size: Geist
// only exists from tier 4 onward, so he gets a short 3-stage arc instead of
// Luna's full multi-quest one. No GameState/localStorage dependency here so
// this can be safely imported from the Cloudflare Worker too.

export type GeistChatStage = "fourth-quest-complete" | "mist-sovereign-defeated" | "casual";

export interface GeistChatFlags {
  fourthQuestComplete: boolean;
  mistSovereignDefeated: boolean;
}

export function getGeistChatStage(flags: GeistChatFlags): GeistChatStage {
  if (flags.fourthQuestComplete) {
    return "fourth-quest-complete";
  }
  if (flags.mistSovereignDefeated) {
    return "mist-sovereign-defeated";
  }
  return "casual";
}

export function isGeistChatStage(value: unknown): value is GeistChatStage {
  return value === "fourth-quest-complete" || value === "mist-sovereign-defeated" || value === "casual";
}

export interface GeistStaticLine {
  id: string;
  text: string;
}

export const GEIST_CASUAL_LINES: GeistStaticLine[] = [
  { id: "casual-0", text: "ガイスト: ……(鎧が小さく震える)" },
  { id: "casual-1", text: "ガイスト: この身に意志が戻ったのは、貴殿のおかげだ。" },
  { id: "casual-2", text: "ガイスト: 深霧の魔王には、油断するな。" },
  { id: "casual-3", text: "ガイスト: 我が拳と鎧、貴殿の盾となろう。" },
  { id: "casual-4", text: "ガイスト: ……長きに渡る眠りの夢を、まだ時折見る。" },
  { id: "casual-5", text: "ガイスト: 貴殿の剣筋、悪くない。" }
];

const STAGE_LINES: Record<Exclude<GeistChatStage, "casual">, GeistStaticLine> = {
  "mist-sovereign-defeated": {
    id: "stage-mist-sovereign-defeated",
    text: "ガイスト: ……深霧の魔王、討ち果たしたか。この鎧に眠っていた無念も、これで晴れよう。"
  },
  "fourth-quest-complete": {
    id: "stage-fourth-quest-complete",
    text: "ガイスト: 里に平穏が戻ったか。貴殿と共に戦えたこと、この身にとって誉れであった。"
  }
};

export function getGeistStaticLinePool(stage: GeistChatStage): GeistStaticLine[] {
  if (stage === "casual") {
    return GEIST_CASUAL_LINES;
  }
  return [STAGE_LINES[stage]];
}

export function getGeistLineForStage(stage: GeistChatStage): string {
  if (stage === "casual") {
    return GEIST_CASUAL_LINES[Math.floor(Math.random() * GEIST_CASUAL_LINES.length)].text;
  }
  return STAGE_LINES[stage].text;
}

export function describeGeistStage(stage: GeistChatStage): string {
  switch (stage) {
    case "fourth-quest-complete":
      return "霧隠れの里に平穏が戻り、長老への報告も終えた。長い眠りから目覚めてから初めて迎える、静かな時間。";
    case "mist-sovereign-defeated":
      return "里の奥、坑道の最深部で深霧の魔王をちょうど討ち果たしたところ。この鎧に宿っていた古い無念が、ようやく晴れつつある。";
    default:
      return "特に大きな出来事は起きていない。勇者と共に村や草原を旅している、何気ない一時。";
  }
}
