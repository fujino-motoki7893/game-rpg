import { hasFlag } from "../game/GameState";

export function getNpcDialogue(npcId: string): string[] {
  if (npcId === "elder") {
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

  if (npcId === "healer") {
    return [
      "ミラ: 傷を癒しましょう。",
      "ミラ: 予備の薬草も荷物に入れておきました。"
    ];
  }

  if (npcId === "shopkeeper") {
    return ["道具屋ニコ: 旅の準備なら、うちに任せて。"];
  }

  return ["返事はない。"];
}

export function getObjective(): string {
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
