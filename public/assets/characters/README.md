# キャラクタースプライトシート

Phaserが読み込む固定グリッドPNGを配置するフォルダです。
Asepriteで書き出したPNGは、下記の形式とファイル名を維持して差し替えてください。

人型キャラクター(`player` / `npc-elder` / `npc-healer` / `npc-shopkeeper` / `npc-armorer` /
`companion-luna`)と一部モンスター(`enemy-skeleton` / `enemy-goblin` / `enemy-mage`)は
Universal LPC Spritesheet Character Generator の素材を合成して生成しています。
`enemy-guardian` / `enemy-bat` / `enemy-slime` は OpenGameArt.org の単体モンスター素材を
切り出して生成しています。残り(`enemy-wolf` / `enemy-mimic`)は方向別グリッドにきれいに
収まる素材が見つかっていないため、プロシージャル生成のままです。
ライセンス・クレジットは [CREDITS.md](CREDITS.md) を参照してください。

## 形式

- ファイル形式: 透明PNG
- レイアウト: 4列 x 4行
- 行の順番: 下、左、右、上
- 列の順番: 待機、歩き1、歩き2、歩き3
- 人物系フレームサイズ: 48x48
- 小型モンスターフレームサイズ: 32x32
- 大型モンスターフレームサイズ: 48x48

## ファイル

- `player.png`: 48x48
- `npc-elder.png`: 48x48
- `npc-healer.png`: 48x48
- `npc-shopkeeper.png`: 48x48
- `npc-armorer.png`: 48x48
- `companion-luna.png`: 48x48
- `enemy-slime.png`: 32x32
- `enemy-goblin.png`: 32x32
- `enemy-bat.png`: 32x32
- `enemy-skeleton.png`: 32x32
- `enemy-wolf.png`: 32x32
- `enemy-mage.png`: 32x32
- `enemy-mimic.png`: 32x32
- `enemy-guardian.png`: 48x48

仮素材(プロシージャル生成のモンスター等)を再生成する場合:

```powershell
npm run assets:characters
```

人型キャラクターを再生成する場合(要ネットワーク接続):

```powershell
npm run assets:humanoids
```

LPC合成モンスター(skeleton/goblin/mage)を再生成する場合(要ネットワーク接続):

```powershell
npm run assets:monsters
```

OpenGameArt単体モンスター(guardian/bat/slime)を再生成する場合(要ネットワーク接続):

```powershell
npm run assets:monsters:external
```
