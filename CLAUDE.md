# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **パッケージマネージャー**: npm
- **開発**: `npm run dev` (ポート5173でVite開発サーバーを起動)
- **ビルド**: `npm run build` (TypeScriptコンパイル + Viteビルド)
- **リント**: `npm run lint` (ESLint)
- **プレビュー**: `npm run preview`
- **Chrome拡張機能として読み込み**: 
  1. `npm run build`でビルド
  2. Chrome拡張機能管理ページで「パッケージ化されていない拡張機能を読み込む」
  3. `frontend/dist`フォルダを選択

### バックエンド (`/request-ai`)
- **パッケージマネージャー**: npm
- **開発**: `npm run dev` または `npm start` (Wrangler開発サーバー)
- **デプロイ**: `npm run deploy` (Cloudflare Workersにデプロイ)
- **テスト**: `npm test` (Vitest)
- **型生成**: `npm run cf-typegen`
- **単一テストの実行**: `npm test -- [テストファイル名]`

## 設定ファイル

### フロントエンド
- `vite.config.ts`: Chrome拡張機能マニフェスト設定を含む（動的マニフェスト生成）
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript設定
- `eslint.config.js`: ESLint設定 (TypeScript-ESLint + React Hooks)
- `.env`ファイルが必要:
  ```
  VITE_GOOGLE_CLIENT_ID=your-google-client-id
  VITE_EXTENSION_PUBLIC_KEY=your-extension-public-key
  ```

### バックエンド
- `wrangler.toml`: Cloudflare Workers設定
  - Durable Objects バインディング (RATE_LIMIT_OBJECT, TOKEN_CACHE_OBJECT)
  - KV namespace (CLOUDFLARE_PUBLIC_JWK_CACHE_KV - Firebase公開鍵キャッシュ用)
  - AI binding for Workers AI
- `vitest.config.mts`: Cloudflare Workers用Vitestテスト設定
- 必要なシークレット: `wrangler secret put GEMINI_API_KEY`

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
- Firebase認証検証 (firebase-auth-cloudflare-workers)
- Durable Objects (レート制限、トークンキャッシュ)
- Cloudflare KV (Firebase公開鍵キャッシュ)
- テスト用Vitest

## 開発時の注意点

- `_locales/`のメッセージファイルによる国際化サポート (Chrome拡張機能の`__MSG_`プレースホルダー)
- パフォーマンス向上のためDurable Objects (TokenCacheObject)で認証トークンをキャッシュ
- ユーザーごとの24時間ウィンドウでレート制限を実装（1日20リクエスト）
- 全通信でHTTPSと適切なCORSヘッダーを使用
- プライバシーポリシーはWorkersエンドポイント`/privacy-policy`で提供
- フロントエンドのビルド時に環境変数が必要 (VITE_GOOGLE_CLIENT_ID, VITE_EXTENSION_PUBLIC_KEY)
- バックエンドはCloudflare Workers環境でのみ動作（Durable Objects使用のため）

## 重要な実装詳細

### Chrome拡張機能マニフェスト (vite.config.ts内で動的生成)
- Manifest V3使用
- 権限: `identity`, `storage`
- OAuth2設定: Google CloudのクライアントIDを環境変数から読み込み
- Content ScriptはすべてのURLにマッチ (`<all_urls>`)
- Web Accessible Resources: Shadow DOM用のSVGアイコン

### Durable Objects アーキテクチャ
- **RateLimitObject**: SQLiteストレージを使用したユーザーごとのレート制限管理
- **TokenCacheObject**: パフォーマンス最適化のためJWTトークンキャッシュ
- 両方ともエッジロケーション間での一貫した状態管理にDurable Objectsを使用

### AIモデル設定
- Google Gemini 2.0 Flash Lite (`GEMINI_API_KEY`が必要)
- Server-Sent Events (SSE)によるストリーミングレスポンス
- 認証済みリクエストのみJWT検証

### Chrome拡張機能コンポーネントの分離
- **Content Script** (`src/content/`): Shadow DOM分離によるテキスト選択UI
- **Background Script** (`src/background/`): API通信用サービスワーカー
- **Popup Script** (`src/popup/`): 拡張機能アイコンインターフェース
- 注意: Chrome拡張機能の「background scripts」はCloudflare Workersバックエンドとは異なります

### 認証フロー
1. Chrome拡張機能identity APIを通じたGoogle OAuth2 (`chrome.identity.launchWebAuthFlow`)
2. Firebase JWTトークン生成 (GoogleAuthProvider.credential)
3. firebase-auth-cloudflare-workersを使用したCloudflare Workersでのトークン検証
4. パフォーマンス向上のためのキャッシュされたトークン検証