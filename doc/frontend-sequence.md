# フロントエンド処理シーケンス図

Chrome拡張機能内での処理フローを示します。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Page as Webページ
    participant Content as Content Script
    participant Background as Background Script
    participant Popup as Popup Script
    participant Firebase as Firebase Auth
    participant API as Cloudflare Workers

    Note over User,API: 初期認証フロー
    User->>Popup: 拡張機能アイコンクリック
    Popup->>Firebase: Google OAuth2認証開始
    Firebase->>User: Google認証画面表示
    User->>Firebase: 認証情報入力
    Firebase-->>Popup: IDトークン取得
    Popup->>Popup: トークンをstorageに保存
    
    Note over User,API: テキスト選択・解析フロー
    User->>Page: テキストを選択
    Page->>Content: selectionchange イベント
    Content->>Content: 選択テキストをキャプチャ
    Content->>Content: Shadow DOM内にDialogを表示
    
    User->>Content: 「解析」ボタンクリック
    Content->>Background: chrome.runtime.sendMessage<br/>{action: "analyzeText", text: selectedText}
    
    Background->>Background: chrome.storage.sync.get("idToken")
    alt トークンが存在し有効
        Background->>API: fetch("/api/request")<br/>Authorization: Bearer token<br/>Body: {text: selectedText}
        
        Note over Background,API: Server-Sent Events処理
        API-->>Background: Content-Type: text/event-stream
        
        loop ストリーミング受信
            API-->>Background: data: チャンクデータ
            Background->>Content: chrome.tabs.sendMessage<br/>{action: "streamChunk", chunk: data}
            Content->>Content: Shadow DOM内に結果を逐次表示
        end
        
        API-->>Background: data: [DONE]
        Background->>Content: chrome.tabs.sendMessage<br/>{action: "streamComplete"}
        Content->>Content: 完了状態に更新
        
    else トークンが無効または期限切れ
        Background->>Content: chrome.tabs.sendMessage<br/>{action: "authRequired"}
        Content->>Content: 認証が必要な旨を表示
        Content->>User: "ログインしてください"メッセージ
        User->>Content: 認証ボタンクリック
        Content->>Background: chrome.runtime.sendMessage<br/>{action: "openPopup"}
        Background->>Popup: chrome.action.openPopup()
    end
    
    Note over User,Content: ダイアログ操作
    User->>Content: ダイアログ外をクリック
    Content->>Content: Shadow DOM Dialogを非表示
    
    alt エラー発生時
        API-->>Background: エラーレスポンス (401/429/500)
        Background->>Content: chrome.tabs.sendMessage<br/>{action: "error", message: errorMsg}
        Content->>Content: エラーメッセージ表示
        Content->>User: エラー内容を通知
    end
```

## 主要コンポーネント

### Content Script
- Webページに注入される
- Shadow DOMでUI分離
- テキスト選択の検出とキャプチャ
- Background Scriptとの双方向通信

### Background Script (Service Worker)
- Chrome拡張機能の中核
- Content ScriptとAPI間の仲介
- 認証トークンの管理
- SSEストリーミングの処理

### Popup Script
- 拡張機能アイコンクリック時のUI
- Google OAuth2認証フロー
- 初期設定とトークン管理

## 通信方式

### chrome.runtime.sendMessage / onMessage
- Content ↔ Background間の通信
- 非同期メッセージング

### chrome.tabs.sendMessage
- Background → Content への一方向通信
- ストリーミングデータの配信

### chrome.storage.sync
- 拡張機能全体でのデータ永続化
- 認証トークンの保存

## Shadow DOM活用
- ホストページのCSSとの競合回避
- 独立したスタイルスコープ
- セキュアなUI表示