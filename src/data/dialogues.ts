import { hasFlag } from "../game/GameState";

export function getNpcDialogue(npcId: string): string[] {
  if (npcId === "elder") {
    if (hasFlag("questComplete")) {
      return [
        "村長ローアン: ストーンブルックはもう安全だ。",
        "村長ローアン: 若き勇者よ、その旅路を胸に刻んでおくれ。"
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

  if (npcId === "healer") {
    return [
      "ミラ: 傷を癒しましょう。",
      "ミラ: 予備の薬草も荷物に入れておきました。"
    ];
  }

  return ["返事はない。"];
}

export function getObjective(): string {
  if (hasFlag("questComplete")) {
    return "クエスト完了";
  }

  if (hasFlag("treasureFound")) {
    return "村長ローアンに報告する";
  }

  if (hasFlag("questAccepted")) {
    return "太陽石を取り戻す";
  }

  return "村長ローアンと話す";
}
