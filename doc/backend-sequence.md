# バックエンド処理シーケンス図

Cloudflare Workers内での処理フローを示します。

```mermaid
sequenceDiagram
    participant Client as Chrome拡張機能
    participant Worker as Cloudflare Workers
    participant TokenCache as TokenCacheObject
    participant RateLimit as RateLimitObject
    participant AI as Cloudflare Workers AI
    participant Firebase as Firebase Auth

    Client->>Worker: POST /api/request<br/>Authorization: Bearer <JWT>
    
    Note over Worker: JWT検証処理開始
    Worker->>TokenCache: checkCachedToken(jwt)
    alt トークンがキャッシュにある
        TokenCache-->>Worker: 検証済みユーザー情報
    else トークンがキャッシュにない
        Worker->>Firebase: Firebase公開鍵取得・JWT検証
        Firebase-->>Worker: 検証結果
        Worker->>TokenCache: cacheToken(jwt, userInfo)
    end
    
    Note over Worker: レート制限チェック
    Worker->>RateLimit: checkAndIncrementLimit(uid)
    RateLimit->>RateLimit: SQLiteからリクエスト数取得
    alt リクエスト制限内
        RateLimit->>RateLimit: リクエスト数をインクリメント
        RateLimit-->>Worker: 許可 (true)
    else リクエスト制限超過
        RateLimit-->>Worker: 拒否 (false)
        Worker-->>Client: 429 Too Many Requests
    end
    
    Note over Worker: AI処理開始
    Worker->>AI: generateStream(prompt, userText)
    
    Note over Worker,Client: Server-Sent Events開始
    Worker-->>Client: Content-Type: text/event-stream
    
    loop ストリーミング処理
        AI-->>Worker: チャンクデータ
        Worker->>Worker: data: イベント形式に変換
        Worker-->>Client: ストリーミングレスポンス
    end
    
    AI-->>Worker: ストリーミング完了
    Worker->>Worker: data: [DONE]
    Worker-->>Client: ストリーミング終了
    
    Note over Worker: ログ記録
    Worker->>Worker: 処理時間・チャンク数をログ出力
```

## 主要コンポーネント

### TokenCacheObject (Durable Object)
- JWTトークンの検証結果をキャッシュ
- パフォーマンス最適化のため重複検証を回避
- SQLiteストレージで永続化

### RateLimitObject (Durable Object)  
- ユーザーごとのレート制限管理
- 24時間ウィンドウで20リクエスト/日の制限
- SQLiteでリクエスト数を追跡

### エラーハンドリング
- JWT無効: 401 Unauthorized
- レート制限超過: 429 Too Many Requests  
- AI処理エラー: 500 Internal Server Error