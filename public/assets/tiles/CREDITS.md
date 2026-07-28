# 地形タイル素材クレジット

`terrain-overworld.png`(草原/草むら/道/水の自動タイル)、`terrain-highland.png`
(「霧の高地」エリア用の雪原/深雪/氷道/水の自動タイル)、`terrain-dungeon.png`
(ダンジョン壁/床の自動タイル、4段階のティア別に色調変更)は、
[[LPC] Terrains](https://opengameart.org/content/lpc-terrains) の
`terrain-map-v7.png`(Tiledの「地形」ツール向けに、隣接する2種類の地形が
なす4隅の組み合わせを16パターンすべて収録したコーナーブレンド・アトラス)
から `scripts/generate-terrain-tiles.mjs` で必要なタイルだけを切り出して
生成しています。ダンジョン版は `sharp` の `tint()` でティアごとに色調を
変えています。

生成に使用したアセットは複数ライセンス(CC-BY-SA 3.0 / CC-BY-SA 4.0)で
提供されています。

## 使用アセットと作者

| 素材 | 作者 |
|---|---|
| [LPC] Terrains (`terrain-map-v7.png`) | bluecarrot16, Lanea Zimmerman (Sharm), Daniel Eddeland (Daneeklu), Richard Kettering (Jetrel), Zachariah Husiar (Zabin), Hyptosis, Casper Nilsson, Buko Studios, Nushio, ZaPaper, billknye, William Thompson, caeles, Stephen Challener (Redshrike), Bertram, Rayane Félix (RayaneFLX) |

ライセンスは CC-BY-SA 3.0 / CC-BY-SA 4.0(いずれか選択可)。表示
(attribution)と、改変後の再配布時は同一ライセンスでの提供(ShareAlike)
が必要です。

## 再生成方法

```powershell
npm run assets:tiles
```

初回実行時にネットワーク経由で `lpc-terrains.zip` をダウンロードし、
`scripts/.terrain-cache/` にキャッシュします。
