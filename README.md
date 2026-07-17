# 小さなターンRPG

王道ファンタジーをテーマにした、ブラウザで遊べるトップダウン型の小さなRPGです。

村で話を聞き、草原を抜け、ランダム生成される複数階層ダンジョンを探索して秘宝を持ち帰ります。クエストを進めると村と草原が広がり、新しいダンジョンやより強いモンスターが出現します。

戦闘はターン制です。レベルアップでスキルを覚え、MPを使って火炎切りや回復魔法を使えます。道具屋や装備屋で旅支度を整え、ダンジョンの宝箱から装備品や帰還の羽などを入手できます。太陽石を取り戻すと仲間のルナが加わり、戦闘を手助けしてくれます。

## 公開URL

https://game-rpg.rpg-game-fujino-6290.workers.dev/

## 主な特徴

- トップダウン型のフィールド探索
- HP/MP、スキル、道具を使うターン制バトル
- レベルアップによるスキル習得
- 村、草原、複数階層ダンジョン
- クエストクリアによる村/草原の拡張と新ダンジョン解放
- ダンジョンのランダム生成と階層ごとの宝箱
- 上り階段と下り階段による階層移動
- 太陽石入手後に加わる仲間ルナとのパーティ戦闘、メニューからのAI生成会話(Groq、ローカル生成へのフォールバック付き)
- 草原モンスターのリポップと、ダンジョン内の制圧感を残す撃破管理
- 近づいた対象の名前や概要を表示するヒントラベル
- 道具屋での売買、MP回復アイテム、ダンジョン脱出アイテム
- 武器、盾、頭、体(上)、体(下)、アクセサリ2枠の装備システム
- ☆1から☆5のアイテム/装備レアリティ
- Canvas生成のマップチップとキャラクター素材
- Cloudflare Workers によるフロントエンド配信とダンジョン生成API

## 操作

```text
移動: 矢印キー / WASD
決定: Space / Enter
メニュー: M / Esc
リセット: R
```

## ローカル起動

Viteで起動する場合:

```powershell
npm install
npm run dev
```

起動後、表示されたローカルURLにアクセスします。通常は以下です。

```text
http://127.0.0.1:5173/
```

Cloudflare Workers の配信とダンジョン生成API込みで起動する場合:

```powershell
npm install
npm run worker:dev
```

起動後、以下にアクセスします。

```text
http://127.0.0.1:8787/
```

## ビルド

```powershell
npm run build
```

## キャラクター素材

Asepriteで作るキャラクターは `public/assets/characters` に配置します。
形式は透明PNGの固定グリッドで、人物系は48x48、スライムなど小型モンスターは32x32です。

```text
4列 x 4行
行: 下 / 左 / 右 / 上
列: 待機 / 歩き1 / 歩き2 / 歩き3
```

仮のスプライトシート(モンスター等)を作り直す場合:

```powershell
npm run assets:characters
```

人型キャラクター(プレイヤー/NPC)と一部モンスター(skeleton/goblin/mage)は
Universal LPC Spritesheet Character Generator の素材を合成して生成しています。
guardian/bat/slime は OpenGameArt.org の単体モンスター素材から生成しています。
作り直す場合(要ネットワーク接続):

```powershell
npm run assets:humanoids
npm run assets:monsters
npm run assets:monsters:external
```

ファイル名や各キャラのフレームサイズ、素材のライセンス/クレジットは `public/assets/characters/README.md`
と `public/assets/characters/CREDITS.md` を参照してください。

## デプロイ

```powershell
npm run worker:deploy
```
