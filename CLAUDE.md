# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリでコードを作業する際のガイダンスを提供します。

## プロジェクト概要

これは「Rocket Search AI」というChrome拡張機能で、ユーザーがWebページ上でテキストを選択すると、即座にAIによる解説を得ることができます。プロジェクトはモノレポ構造を採用し、2つの主要コンポーネントで構成されています：

- **フロントエンド** (Chrome拡張機能): `/frontend`に配置されたReact + TypeScriptアプリケーション
- **バックエンド** (Cloudflare Workers): `/request-ai`に配置されたAPIサービス

## アーキテクチャ

### フロントエンド Chrome拡張機能 (`/frontend`)
- **Popup**: 拡張機能アイコンクリック時のインターフェース (`src/popup/`)
- **Content Script**: Webページに注入され、選択されたテキストをキャプチャ (`src/content/`)
- **Background Script**: Content ScriptとバックエンドAPIの通信を管理 (`src/background/`)
- ホストページのスタイルとの競合を避けるためShadow DOMを使用
- Google OAuth2によるFirebase認証を実装
- Vite + @crxjs/vite-pluginでChrome拡張機能開発を行う

### バックエンド Cloudflare Workers (`/request-ai`)
- Chrome拡張機能からのAPIリクエストを処理
- テキスト解析のためGoogle Gemini AIと連携
- 認証のためFirebase JWT検証を実装
- レート制限機能（ユーザーあたり1日20リクエスト）
- Server-Sent Events (SSE)を使用したレスポンスストリーミング

### 通信フロー
1. Content Scriptがユーザー選択テキストをキャプチャ
2. Background Scriptがデータを受信してCloudflare Workersに転送
3. Cloudflare WorkersがGemini AIでリクエストを処理
4. レスポンスがBackground Script経由でContent Scriptにストリームバック

## 開発コマンド

### フロントエンド (`/frontend`)
- **パッケージマネージャー**: pnpm
- **開発**: `pnpm dev` (ポート5173でVite開発サーバーを起動)
- **ビルド**: `pnpm build` (TypeScriptコンパイル + Viteビルド)
- **リント**: `pnpm lint` (ESLint)
- **プレビュー**: `pnpm preview`

### バックエンド (`/request-ai`)
- **パッケージマネージャー**: npm
- **開発**: `npm run dev` または `npm start` (Wrangler開発サーバー)
- **デプロイ**: `npm run deploy` (Cloudflare Workersにデプロイ)
- **テスト**: `npm test` (Vitest)
- **型生成**: `npm run cf-typegen`

## 設定ファイル

### フロントエンド
- `vite.config.ts`: Chrome拡張機能マニフェスト設定を含む
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript設定
- `eslint.config.js`: ESLint設定
- FirebaseとGoogle OAuth認証情報を含む`.env`ファイルが必要

### バックエンド
- `wrangler.toml`: KVネームスペースを含むCloudflare Workers設定
- `vitest.config.mts`: Vitestテスト設定
- 必要な環境変数: GEMINI_API_KEY、Firebase設定

## 主要技術

### フロントエンド
- React 19 with TypeScript
- Mantine UIコンポーネント
- Firebase Authentication (web-extension)
- Chrome Extensions API
- @crxjs/vite-pluginを使用したViteビルドシステム

### バックエンド
- Cloudflare Workersランタイム
- Google Generative AI (Gemini 2.0 Flash Lite)
- Firebase認証検証
- キャッシュとレート制限のためのCloudflare KV
- テスト用Vitest

## 開発時の注意点

- `_locales/`のメッセージファイルによる国際化サポート
- パフォーマンス向上のためCloudflare KVで認証トークンをキャッシュ
- ユーザーごとの24時間ウィンドウでレート制限を実装（1日20リクエスト）
- 全通信でHTTPSと適切なCORSヘッダーを使用
- プライバシーポリシーはWorkersエンドポイント`/privacy-policy`で提供

## 重要な実装詳細

### Durable Objects アーキテクチャ
- **RateLimitObject**: SQLiteストレージを使用したユーザーごとのレート制限管理
- **TokenCacheObject**: パフォーマンス最適化のためJWTトークンキャッシュ
- 両方ともエッジロケーション間での一貫した状態管理にDurable Objectsを使用

### AIモデル設定
- `llama-4-scout-17b-16e-instruct`モデルでCloudflare Workers AIを使用
- Server-Sent Events (SSE)によるストリーミングレスポンス
- 認証済みリクエストのみJWT検証

### Chrome拡張機能コンポーネントの分離
- **Content Script** (`src/content/`): Shadow DOM分離によるテキスト選択UI
- **Background Script** (`src/background/`): API通信用サービスワーカー
- **Popup Script** (`src/popup/`): 拡張機能アイコンインターフェース
- 注意: Chrome拡張機能の「background scripts」はCloudflare Workersバックエンドとは異なります

### 主要な環境変数
- フロントエンド: `GOOGLE_CLIENT_ID`, `EXTENSION_PUBLIC_KEY` (Chrome Web Store用)
- バックエンド: Firebase設定、Cloudflare Workers環境で管理されるGemini APIキー

### 認証フロー
1. Chrome拡張機能identity APIを通じたGoogle OAuth2
2. Firebase JWTトークン生成
3. firebase-auth-cloudflare-workersを使用したCloudflare Workersでのトークン検証
4. パフォーマンス向上のためのキャッシュされたトークン検証