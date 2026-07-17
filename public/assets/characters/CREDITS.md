# キャラクター素材クレジット

`player.png` / `npc-elder.png` / `npc-healer.png` / `npc-shopkeeper.png` / `npc-armorer.png` および
`enemy-skeleton.png` / `enemy-goblin.png` / `enemy-mage.png` は
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
が配布する素材(body/head/hair/torso/legs/feet/hatの各レイヤー)を `scripts/generate-humanoid-sprites.mjs` /
`scripts/generate-monster-sprites.mjs` で合成して生成しています。
残りの `enemy-*.png`(slime/bat/wolf/mimic/guardian)は従来どおり `scripts/generate-character-sheets.mjs`
によるプロシージャル生成です(LPCには四足獣・無定形モンスター用の骨格が無いため対象外)。

生成に使用した個別アセットは複数ライセンス(OGA-BY 3.0 / CC-BY-SA 3.0 / CC-BY 4.0 / GPL 2.0 / GPL 3.0 など)で
提供されています。使用したすべてのアセットに共通して選択可能なのは **GPL 3.0** のみだったため、
このプロジェクトでは GPL 3.0 に基づいて利用しています。GPL 3.0 は表示(attribution)と、
再配布する場合はソース(このリポジトリ)を同様に入手可能にすることを要求します。

## 使用アセットと作者

| レイヤー | パス | 作者 |
|---|---|---|
| body (male) | `body/bodies/male/walk.png` | bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| body (female) | `body/bodies/female/walk.png` | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| body (muscular, goblin用に緑へ再着色) | `body/bodies/muscular/walk.png` | bluecarrot16, JaidynReiman, Evert, TheraHedwig, MuffinElZangano, Durrani, Sander Frenken (castelonia), Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), dalonedrau, Stephen Challener (Redshrike) |
| body (skeleton) | `body/bodies/skeleton/walk/skeleton.png` | bluecarrot16, Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| head (male) | `head/heads/human/male/walk.png` | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) |
| head (female) | `head/heads/human/female/walk.png` | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) |
| head (female elderly) | `head/heads/human/female_elderly/walk.png` | Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), Stephen Challener (Redshrike) |
| head (skeleton) | `head/heads/skeleton/adult/walk/skeleton.png` | bluecarrot16, Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| head (goblin) | `head/heads/goblin/adult/walk.png` | bluecarrot16, Stephen Challener (Redshrike), William.Thomsponj |
| hair (plain) | `hair/plain/adult/walk.png` | JaidynReiman, Manuel Riecke (MrBeast), Joe White |
| torso: vest (male) | `torso/clothes/vest/male/walk/{blue,tan}.png` | bluecarrot16, Thane Brimhall (pennomi), laetissima, Stephen Challener (Redshrike), Johannes Sjölund (wulax) |
| torso: robe (female) | `torso/clothes/robe/female/walk/{brown,white,purple}.png` | Luke Mehl |
| torso: plate armour (male) | `torso/armour/plate/male/walk.png` | Napsio (Vitruvian Studio), JaidynReiman, bluecarrot16, Michael Whitlock (bigbeargames), Johannes Sjölund (wulax) |
| legs: pants (male) | `legs/pants/male/walk.png` | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| feet: shoes (male) | `feet/shoes/basic/male/walk.png` | JaidynReiman, bluecarrot16, Johannes Sjölund (wulax) |
| hat: wizard hat | `hat/magic/wizard/base/adult/walk.png` | Michael Whitlock (bigbeargames), Tuomo Untinen (reemax), JaidynReiman |

## キャラクター/モンスターごとの構成

| キャラクター | 体型/頭 | 髪色 | 服装 |
|---|---|---|---|
| player | male | chestnut | vest (blue) + pants + shoes |
| npc-elder | female / female_elderly | white | robe (brown) |
| npc-healer | female | dark_brown | robe (white) |
| npc-shopkeeper | male | light_brown | vest (tan) + pants + shoes |
| npc-armorer | male | black | plate armour + pants + shoes |
| enemy-skeleton | skeleton body/head | - | (なし、骨のみ) |
| enemy-goblin | muscular body(緑に再着色)/ goblin head | - | pants |
| enemy-mage | female body/head | dark_brown | robe (purple) + wizard hat |

## 再生成方法

```powershell
npm run assets:humanoids
npm run assets:monsters
```

初回実行時にGitHub(raw.githubusercontent.com)から素材をダウンロードし、`scripts/.lpc-cache/`
にキャッシュします(ネットワーク接続が必要)。残りの `enemy-*.png` は引き続き `npm run assets:characters`
(オフラインのプロシージャル生成)で再生成します。
