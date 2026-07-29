# Supabase 連携ガイド

このゲームのセーブデータは `localStorage` に保存された上で、`VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` が設定されている場合のみ Supabase へバックグラウンド同期されます
(`src/game/cloudSync.ts`)。未設定なら以前と同じくローカルのみで動作するので、
既存のCloudflare Workers(`src/worker/index.ts`)の構成は変更していません。

## 仕組みのおさらい

- 起動時、ローカルに一度もセーブが無い(=新しい端末/ブラウザ)場合だけ、
  `initCloudSave()` (`src/game/GameState.ts`) がクラウド側のセーブを取得して復元します。
  ローカルにセーブが既にある場合は常にローカル優先です(競合解決はしていません)。
- 認証は **匿名認証(Anonymous Sign-in)** を使用し、ログイン画面はありません。
  同じブラウザなら同じ匿名ユーザーIDが再利用されます。
- 保存先は `saves` テーブル1本、`data` (jsonb) に `GameSave` をそのまま格納します
  (`supabase/migrations/20260729000000_create_saves.sql`)。
- `persistSave()` が呼ばれる度に3秒デバウンスでクラウドへupsertします(頻繁な保存操作の負荷対策)。

## 1. SupabaseダッシュボードでのUI設定

1. https://supabase.com でプロジェクトを作成(既に用意済みならこの手順は不要)。
2. **Authentication → Sign In / Up → Anonymous** を開き、匿名サインインを **有効化** する。
   (無料プランでも利用可能な機能です。)
3. **SQL Editor** を開き、`supabase/migrations/20260729000000_create_saves.sql` の内容を貼り付けて実行する。
   これで `saves` テーブル作成 + Row Level Security (RLS) の有効化 + 「自分の行しか読み書きできない」ポリシーまで設定されます。
   - `Table Editor` で `saves` テーブルが出現し、RLSが緑色で "Enabled" になっていることを確認。
4. **Project Settings → API** を開き、`Project URL` と `anon public` キーをコピーする。
5. リポジトリの `.env` に以下を設定する(このリポジトリでは既に `.gitignore` 対象):
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...(anon key)
   ```
6. `npm run dev` で起動すればクラウド同期が有効になります。ブラウザのDevTools → Application →
   Local Storage を見ると `sb-...-auth-token` という匿名セッションのキーが増えているはずです。
7. Supabase側の **Table Editor → saves** で、プレイ後しばらく(3秒+通信時間)待つと行が増える/更新されることを確認できます。

> **注意**: `anon` キーはクライアントに埋め込まれる前提の公開キーです。安全性はテーブルの
> RLSポリシーが担保するので、上記のSQLを流し忘れると全ユーザーが他人のセーブを読み書きできる
> 状態になってしまいます。必ずポリシー適用まで確認してください。
> `service_role` キーは絶対にクライアントコードや `.env`(VITE_ 接頭辞)に入れないでください。

## 2. Dockerでローカル環境にDBを立てる方法

Supabase CLIは内部でDocker Composeを使い、Postgres・Auth・Studio等をまとめてローカルに
立ち上げます。事前に **Docker Desktop** が起動している必要があります。

### 初回セットアップ

```bash
# CLIのインストール(Windows/PowerShellの例。Node経由でも可)
npm install -g supabase

# リポジトリルートで初期化(supabase/config.toml が無ければ生成される)
# 既に supabase/migrations/ はコミットされているのでそのまま使われます
supabase init

# ローカルスタックの起動(Dockerコンテナが立ち上がる)
supabase start
```

`supabase start` の出力に、ローカル用の値が表示されます。これを **ローカル開発専用の**
`.env` に設定します(本番のSupabaseプロジェクトの値とは別物です):

```
API URL: http://127.0.0.1:54321
anon key: ey...
```

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=(上記の anon key)
```

マイグレーション(`supabase/migrations/*.sql`)はこの `supabase start` 時、または

```bash
supabase db reset
```

で自動的に適用されます(`saves` テーブルとRLSポリシーが作られます)。匿名認証は
ローカルスタックでもデフォルトで有効です。

### ローカルStudioでの確認

`supabase start` 実行後、`http://127.0.0.1:54323` でローカル版のダッシュボード
(Studio)が開けます。Table Editor / SQL Editor / Auth のユーザー一覧など、本番と
同じUIをローカルDBに対して使えます。

### 停止・破棄

```bash
supabase stop          # コンテナを停止(データは保持)
supabase stop --no-backup  # データも含めて破棄
```

### 本番への反映

ローカルで動作確認したマイグレーションを本番Supabaseに反映する場合:

```bash
supabase link --project-ref <本番プロジェクトのref>
supabase db push
```

## 3. 今後の拡張候補(未実装・要検討)

- 現在はチート対策を行っていません(クライアントから直接RLS越しに書き込む方式)。
  将来的に不正防止が必要になった場合は、Cloudflare Worker(`src/worker/index.ts`)に
  `/api/save` を追加し、`service_role` キーを使ってサーバー側から書き込む構成に
  変更することを検討してください。
- 複数デバイス間でどちらのセーブを使うか選ばせるUI(現状は「ローカルがあれば常にローカル優先」)。
