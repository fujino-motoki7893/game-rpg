# キャラクター素材クレジット

`player.png` / `npc-elder.png` / `npc-healer.png` / `npc-shopkeeper.png` / `npc-armorer.png` は
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
が配布する素材(body/head/hair/torso/legs/feetの各レイヤー)を `scripts/generate-humanoid-sprites.mjs` で
合成して生成しています。`enemy-*.png` は従来どおり `scripts/generate-character-sheets.mjs` によるプロシージャル生成です。

生成に使用した個別アセットは複数ライセンス(OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0 など)で提供されており、
このプロジェクトでは **CC-BY-SA 3.0** に基づいて利用しています。CC-BY-SA 3.0 は表示(attribution)と
継承(share-alike: 同一ライセンスでの再配布)を要求するため、これらの合成済みスプライトシート自体も
CC-BY-SA 3.0 の下で利用可能です。

## 使用アセットと作者

| レイヤー | パス | 作者 |
|---|---|---|
| body (male) | `body/bodies/male/walk.png` | bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| body (female) | `body/bodies/female/walk.png` | Benjamin K. Smith (BenCreating), bluecarrot16, TheraHedwig, Evert, MuffinElZangano, Durrani, Pierre Vigier (pvigier), ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| head (male) | `head/heads/human/male/walk.png` | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) |
| head (female) | `head/heads/human/female/walk.png` | bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike) |
| head (female elderly) | `head/heads/human/female_elderly/walk.png` | Benjamin K. Smith (BenCreating), Eliza Wyatt (ElizaWy), Stephen Challener (Redshrike) |
| hair (plain) | `hair/plain/adult/walk.png` | JaidynReiman, Manuel Riecke (MrBeast), Joe White |
| torso: vest (male) | `torso/clothes/vest/male/walk/{blue,tan}.png` | bluecarrot16, Thane Brimhall (pennomi), laetissima, Stephen Challener (Redshrike), Johannes Sjölund (wulax) |
| torso: robe (female) | `torso/clothes/robe/female/walk/{brown,white}.png` | Luke Mehl |
| torso: plate armour (male) | `torso/armour/plate/male/walk.png` | Napsio (Vitruvian Studio), JaidynReiman, bluecarrot16, Michael Whitlock (bigbeargames), Johannes Sjölund (wulax) |
| legs: pants (male) | `legs/pants/male/walk.png` | bluecarrot16, JaidynReiman, ElizaWy, Matthew Krohn (makrohn), Johannes Sjölund (wulax), Stephen Challener (Redshrike) |
| feet: shoes (male) | `feet/shoes/basic/male/walk.png` | JaidynReiman, bluecarrot16, Johannes Sjölund (wulax) |

## キャラクターごとの構成

| キャラクター | 体型/頭 | 髪色 | 服装 |
|---|---|---|---|
| player | male | chestnut | vest (blue) + pants + shoes |
| npc-elder | female / female_elderly | white | robe (brown) |
| npc-healer | female | dark_brown | robe (white) |
| npc-shopkeeper | male | light_brown | vest (tan) + pants + shoes |
| npc-armorer | male | black | plate armour + pants + shoes |

## 再生成方法

```powershell
npm run assets:humanoids
```

初回実行時にGitHub(raw.githubusercontent.com)から素材をダウンロードし、`scripts/.lpc-cache/`
にキャッシュします(ネットワーク接続が必要)。`enemy-*.png` は引き続き `npm run assets:characters`
(オフラインのプロシージャル生成)で再生成します。
