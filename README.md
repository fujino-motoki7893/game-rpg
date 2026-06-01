# 小さなターンRPG

王道ファンタジーをテーマにした、ブラウザで遊べるトップダウン型の小さなRPGです。

村で話を聞き、草原を抜け、ランダム生成されるダンジョンを探索して、最奥に眠る太陽石を手に入れることを目指します。戦闘はターン制で、ダンジョンは複数階層を持ち、階段で前後の階へ移動できます。

## 公開URL

https://game-rpg.rpg-game-fujino-6290.workers.dev/

## 主な特徴

- トップダウン型のフィールド探索
- ターン制バトル
- 村、草原、複数階層ダンジョン
- ダンジョンのランダム生成
- 上り階段と下り階段による階層移動
- Canvas生成のマップチップとキャラクター素材
- Cloudflare Workers によるフロントエンド配信とダンジョン生成API

## ローカル起動

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

## デプロイ

```powershell
npm run worker:deploy
```
