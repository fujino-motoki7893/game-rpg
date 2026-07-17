# キャラクター素材クレジット

`player.png` / `npc-elder.png` / `npc-healer.png` / `npc-shopkeeper.png` / `npc-armorer.png` /
`companion-luna.png` および `enemy-skeleton.png` / `enemy-goblin.png` / `enemy-mage.png` は
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
が配布する素材(body/head/hair/torso/legs/feet/hatの各レイヤー)を `scripts/generate-humanoid-sprites.mjs` /
`scripts/generate-monster-sprites.mjs` で合成して生成しています。

`enemy-guardian.png` / `enemy-bat.png` / `enemy-slime.png` は、LPCコミュニティの作者による
OpenGameArt.org上の単体モンスター素材(人型骨格に依らない独自シート)を
`scripts/generate-monster-sprites-external.mjs` で切り出して生成しています。

残りの `enemy-*.png`(wolf/mimic)は従来どおり `scripts/generate-character-sheets.mjs` による
プロシージャル生成です。狼・ミミック用の素材候補は見つかっていますが、方向別グリッドに
きれいに収まらない構成(狼はPSD配布で二足/四足ポーズが混在、ミミックは開閉状態のみで
歩行フレームが無い)のため、安全に変換できる目処が立った時点で対応します。

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
| torso: dress (sash, female) | `dress/sash/female/walk/lavender.png` | bluecarrot16, Thane Brimhall (pennomi), laetissima, Matthew Krohn (makrohn) |
| torso: plate armour (male) | `torso/armour/plate/male/walk.png` | Napsio (Vitruvian Studio), JaidynReiman, bluecarrot16, Michael Whitlock (bigbeargames), Johannes Sjölund (wulax) |
| legs: pants (male) | `legs/pants/male/walk.png` | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| feet: shoes (male) | `feet/shoes/basic/male/walk.png` | JaidynReiman, bluecarrot16, Johannes Sjölund (wulax) |
| hat: wizard hat | `hat/magic/wizard/base/adult/walk.png` | Michael Whitlock (bigbeargames), Tuomo Untinen (reemax), JaidynReiman |

### OpenGameArt単体モンスター素材

| モンスター | 素材 | ページ | 作者 | ライセンス |
|---|---|---|---|---|
| enemy-guardian | golem-walk.png | [LPC Golem](https://opengameart.org/content/lpc-golem) | Stephen Challener (Redshrike), William.Thomsponj | CC-BY / GPL / OGA-BY |
| enemy-bat | bat-NESW.png (48x64) | [Bat (Rework)](https://opengameart.org/content/bat-rework) | bagzie, reworked by AntumDeluge | CC-BY 3.0 / OGA-BY 3.0 |
| enemy-slime | slime.png | [LPC Monsters](https://opengameart.org/content/lpc-monsters) | Charles Sanchez (CharlesGabriel), bagzie, bluecarrot16 | CC-BY-SA 3.0 / GPL 3.0 |

## キャラクター/モンスターごとの構成

| キャラクター | 体型/頭 | 髪色 | 服装 |
|---|---|---|---|
| player | male | chestnut | vest (blue) + pants + shoes |
| npc-elder | female / female_elderly | white | robe (brown) |
| npc-healer | female | dark_brown | robe (white) |
| npc-shopkeeper | male | light_brown | vest (tan) + pants + shoes |
| npc-armorer | male | black | plate armour + pants + shoes |
| companion-luna | female | platinum | dress (lavender sash) |
| enemy-skeleton | skeleton body/head | - | (なし、骨のみ) |
| enemy-goblin | muscular body(緑に再着色)/ goblin head | - | pants |
| enemy-mage | female body/head | dark_brown | robe (purple) + wizard hat |
| enemy-guardian | LPC Golem(単体素材、そのまま) | - | - |
| enemy-bat | Bat Rework(単体素材、そのまま) | - | - |
| enemy-slime | LPC Monsters slime(単体素材、方向を問わず同一フレームを使い回し) | - | - |

## 再生成方法

```powershell
npm run assets:humanoids
npm run assets:monsters
npm run assets:monsters:external
```

初回実行時にネットワーク経由で素材をダウンロードし、`scripts/.lpc-cache/`(GitHub)/
`scripts/.oga-cache/`(OpenGameArt)にキャッシュします。残りの `enemy-*.png`(wolf/mimic)は
引き続き `npm run assets:characters`(オフラインのプロシージャル生成)で再生成します。
