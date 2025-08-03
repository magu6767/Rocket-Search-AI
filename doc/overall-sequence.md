# 全体システムシーケンス図

Rocket Search AI全体のエンドツーエンド処理フローを示します。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant WebPage as Webページ
    participant ContentScript as Content Script<br/>(Shadow DOM)
    participant BackgroundScript as Background Script<br/>(Service Worker)
    participant PopupScript as Popup Script
    participant ChromeAPI as Chrome APIs<br/>(Storage/Identity)
    participant Firebase as Firebase Auth
    participant CloudflareWorkers as Cloudflare Workers
    participant TokenCache as TokenCacheObject<br/>(Durable Object)
    participant RateLimit as RateLimitObject<br/>(Durable Object)
    participant WorkersAI as Cloudflare Workers AI<br/>(Llama-4-Scout)

    Note over User,WorkersAI: 【Phase 1: 初期認証・セットアップ】
    User->>PopupScript: 拡張機能初回起動
    PopupScript->>ChromeAPI: chrome.identity.getAuthToken()
    ChromeAPI->>Firebase: Google OAuth2フロー開始
    Firebase->>User: 認証画面表示
    User->>Firebase: Google認証情報入力
    Firebase-->>ChromeAPI: IDトークン発行
    ChromeAPI-->>PopupScript: トークン取得完了
    PopupScript->>ChromeAPI: chrome.storage.sync.set({idToken})
    PopupScript->>User: 認証完了通知

    Note over User,WorkersAI: 【Phase 2: テキスト選択・解析リクエスト】
    User->>WebPage: Webページでテキストを選択
    WebPage->>ContentScript: selectionchange イベント発火
    ContentScript->>ContentScript: Shadow DOM内にダイアログ表示
    ContentScript->>User: "解析"ボタン表示

    User->>ContentScript: "解析"ボタンクリック
    ContentScript->>BackgroundScript: chrome.runtime.sendMessage<br/>{action: "analyzeText", text: selectedText}
    
    BackgroundScript->>ChromeAPI: chrome.storage.sync.get("idToken")
    ChromeAPI-->>BackgroundScript: 保存済みトークン取得

    Note over User,WorkersAI: 【Phase 3: バックエンド処理・AI解析】
    BackgroundScript->>CloudflareWorkers: POST /api/request<br/>Authorization: Bearer <JWT><br/>Body: {text: selectedText}
    
    Note over CloudflareWorkers,WorkersAI: JWT検証・キャッシュチェック
    CloudflareWorkers->>TokenCache: checkCachedToken(jwt)
    alt トークンキャッシュ済み
        TokenCache-->>CloudflareWorkers: 検証済みユーザー情報
    else トークン未キャッシュ
        CloudflareWorkers->>Firebase: 公開鍵取得・JWT検証
        Firebase-->>CloudflareWorkers: 検証結果・ユーザー情報
        CloudflareWorkers->>TokenCache: cacheVerifiedToken(jwt, userInfo)
    end

    Note over CloudflareWorkers,WorkersAI: レート制限チェック
    CloudflareWorkers->>RateLimit: checkAndIncrementLimit(uid)
    RateLimit->>RateLimit: SQLiteから今日のリクエスト数取得
    alt リクエスト数 < 20/日
        RateLimit->>RateLimit: カウンターをインクリメント
        RateLimit-->>CloudflareWorkers: 処理許可 (true)
    else リクエスト上限到達
        RateLimit-->>CloudflareWorkers: 処理拒否 (false)
        CloudflareWorkers-->>BackgroundScript: 429 Too Many Requests
        BackgroundScript->>ContentScript: エラー通知
        ContentScript->>User: "制限に達しました"メッセージ
    end

    Note over CloudflareWorkers,WorkersAI: AI解析処理
    CloudflareWorkers->>WorkersAI: generateStream({<br/>  model: "llama-4-scout-17b-16e-instruct",<br/>  prompt: systemPrompt + userText<br/>})
    
    Note over User,WorkersAI: 【Phase 4: ストリーミングレスポンス】
    CloudflareWorkers-->>BackgroundScript: Content-Type: text/event-stream<br/>開始

    loop AI生成ストリーミング
        WorkersAI-->>CloudflareWorkers: チャンクデータ生成
        CloudflareWorkers->>CloudflareWorkers: data: JSON形式に変換
        CloudflareWorkers-->>BackgroundScript: Server-Sent Event送信
        BackgroundScript->>ContentScript: chrome.tabs.sendMessage<br/>{action: "streamChunk", data: chunk}
        ContentScript->>ContentScript: Shadow DOM内に結果を逐次描画
        ContentScript->>User: リアルタイム解析結果表示
    end

    WorkersAI-->>CloudflareWorkers: 生成完了シグナル
    CloudflareWorkers->>CloudflareWorkers: data: [DONE]
    CloudflareWorkers-->>BackgroundScript: ストリーミング終了
    BackgroundScript->>ContentScript: chrome.tabs.sendMessage<br/>{action: "streamComplete"}
    ContentScript->>ContentScript: 完了状態に更新
    ContentScript->>User: 最終結果表示完了

    Note over User,WorkersAI: 【Phase 5: クリーンアップ・ログ】
    CloudflareWorkers->>CloudflareWorkers: パフォーマンスログ出力<br/>(処理時間・チャンク数)
    
    User->>ContentScript: ダイアログ外クリック
    ContentScript->>ContentScript: Shadow DOMダイアログ非表示

    Note over User,WorkersAI: 【エラーハンドリング分岐】
    alt 認証エラー (401)
        CloudflareWorkers-->>BackgroundScript: 401 Unauthorized
        BackgroundScript->>ContentScript: 再認証要求
        ContentScript->>User: "再度ログインしてください"
        User->>ContentScript: 認証ボタンクリック
        ContentScript->>BackgroundScript: Popup開起要求
        BackgroundScript->>PopupScript: chrome.action.openPopup()
    else AIエラー (500)
        CloudflareWorkers-->>BackgroundScript: 500 Internal Server Error  
        BackgroundScript->>ContentScript: エラー通知
        ContentScript->>User: "一時的なエラーが発生しました"
    end
```

## システム全体の特徴

### アーキテクチャパターン
- **Chrome拡張機能**: MV3準拠のService Worker型
- **バックエンド**: Serverless + Edge Computing (Cloudflare Workers)
- **AI処理**: ストリーミング対応リアルタイム生成
- **認証**: OAuth2 + JWT + Firebase連携

### パフォーマンス最適化
- **トークンキャッシュ**: Durable Objectsで重複検証回避
- **エッジ処理**: 世界各地のCloudflareエッジでレート制限・AI処理
- **ストリーミング**: Server-Sent Eventsでリアルタイム表示
- **Shadow DOM**: ホストページの干渉を排除

### セキュリティ・制限
- **レート制限**: 20リクエスト/日/ユーザー
- **JWT検証**: Firebase公開鍵による署名検証
- **権限最小化**: 必要最小限のChrome拡張機能権限
- **CORS対応**: 適切なオリジン制限

### 国際化対応
- **多言語UI**: `_locales/` での言語ファイル管理
- **AI応答**: ユーザーの言語設定に応じた解析結果