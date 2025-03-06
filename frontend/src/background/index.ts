import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth/web-extension";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};


// 参考：https://zenn.dev/karabiner_inc/articles/7197d6565ec2d4
const signIn = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    initializeApp(firebaseConfig);
    // マニフェストからOAuth2の設定を取得
    const manifest = chrome.runtime.getManifest();
    const oauth2Manifest = manifest.oauth2;
    if (!oauth2Manifest) {
      throw new Error('OAuth2の設定が見つかりません');
    }
    const clientId = oauth2Manifest.client_id;
    const scopes = oauth2Manifest.scopes;
    if (!scopes) {
      throw new Error('OAuth2のスコープが設定されていません');
    }

    // 認証URLを生成
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&response_type=token&scope=${encodeURIComponent(scopes.join(' '))}`;

    // Google側での認証（ユーザーがGoogleアカウントを使用して認証を行う）
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      interactive: true,
      url: authUrl
    });

    if (!responseUrl) {
      return { success: false, error: 'ログインがキャンセルされました' };
    }

    // URLからアクセストークンを取得
    const searchParams = new URL(responseUrl.replace(/#/, '?')).searchParams;
    const token = searchParams.get('access_token');
    if (!token) {
      return { success: false, error: 'アクセストークンの取得に失敗しました' };
    }

    const auth = getAuth();
    // Google の OAuth トークン（アクセストークン）を Firebase が理解できる credential に変換する
    const credential = GoogleAuthProvider.credential(null, token);

    // 生成した credential を Firebase サーバーに送信し、トークンの正当性を検証する
    // 検証成功後、idTokenを取得し、Firebase はユーザーアカウントを作成または取得し、認証状態を確立する
    const userCredential = await signInWithCredential(auth, credential);
    const idToken = await userCredential.user.getIdToken();
    const refreshToken = await userCredential.user.refreshToken;
    await chrome.storage.local.set({ idToken });
    await chrome.storage.local.set({ refreshToken });
    return { success: true };
  } catch (error) {
    console.error('ログインエラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ログイン中にエラーが発生しました'
    };
  }
};

const fetchDictionary = async (text: string, idToken: string) => {
  const response = await fetch('https://request-ai.mogeko6347.workers.dev', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: text })
  });
  return response;
};

const refreshIdToken = async (refreshToken: string) => {
  try {
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${import.meta.env.VITE_FIREBASE_API_KEY}`, {
      method: 'POST',
      body: JSON.stringify({ 
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`再度ログインしてください`);
    }

    const data = await response.json();

    return data.id_token;
  } catch (error) {
    console.error('トークンリフレッシュエラー:', error);
    throw new Error(error instanceof Error ? error.message : 'トークンのリフレッシュ中に予期せぬエラーが発生しました');
  }
};


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'signIn') {
    (async () => {
      try {
        const result = await signIn();
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'ログイン処理中にエラーが発生しました'
        });
      }
    })();
    return true;
  }
  
  if (request.action === 'fetchDictionary') {
    (async () => {
      try {
        const { idToken } = await chrome.storage.local.get('idToken');
        if (!idToken) {
          console.log('idTokenが見つかりません');
          sendResponse({
            error: true,
            message: '認証が必要です'
          });
          return;
        }
        if (request.text.length > 10000) {
          sendResponse({
            error: true,
            message: '選択されたテキストが長すぎます'
          });
          return;
        }

        let response = await fetchDictionary(request.text, idToken);

        // エラーが返ってきたら、リフレッシュトークンを使用してidTokenを更新する
        if (!response.ok) {
          const errorText = await response.text();
          console.log('APIリクエストに失敗しました', response.status, errorText);

          // 429エラーの場合はそのままエラーをスロー
          if (response.status === 429) {
            throw new Error(`${errorText}`);
          }

          // それ以外のエラーの場合はトークンをリフレッシュして再試行
          const { refreshToken } = await chrome.storage.local.get('refreshToken');
          if (refreshToken) {
            const refreshedIdToken = await refreshIdToken(refreshToken);
            await chrome.storage.local.set({ idToken: refreshedIdToken });
            const retryResponse = await fetchDictionary(request.text, refreshedIdToken);
            if (!retryResponse.ok) {
              throw new Error(`APIリクエストに失敗しました: ${ await retryResponse.text()}`);
            }
            response = retryResponse;
          } else {
            throw new Error('再度ログインしてください');
          }
        }

        // ストリームの開始を通知
        sendResponse({
          error: false,
          stream: true,
          message: 'stream_start'
        });

        // SSEリーダーの設定
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) {
          throw new Error('Failed to create stream reader');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // 最後の行は完全でない可能性があるため、バッファに残す
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                // ストリームの終了を通知
                chrome.tabs.sendMessage(sender.tab!.id!, {
                  action: 'streamEnd'
                });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.result) {
                  // Content Scriptにチャンクを送信
                  chrome.tabs.sendMessage(sender.tab!.id!, {
                    action: 'streamChunk',
                    chunk: parsed.result
                  });
                }
              } catch (e) {
                console.error('Failed to parse chunk:', e);
              }
            }
          }
        }

      } catch (error) {
        sendResponse({
          error: true,
          message: error instanceof Error ? error.message : '不明なエラー'
        });
      }
    })();
    return true;
  }
});