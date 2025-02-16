import { initializeApp } from "firebase/app";
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBD03JuDxiNNz-yZGi8CJrTjj2LiCR6FUU",
  authDomain: "web-extention.firebaseapp.com",
  projectId: "web-extention",
  storageBucket: "web-extention.firebasestorage.app",
  messagingSenderId: "503808106062",
  appId: "1:503808106062:web:349c320b47f90a181fed1f"
};

initializeApp(firebaseConfig);

console.log('background.ts');

const signIn = async (sendResponse:any) => {
  // あとで構造を理解する
  const manifest = chrome.runtime.getManifest();
  const oauth2Manifest = manifest.oauth2;
  if (!oauth2Manifest) {
    throw new Error('OAuth2 configuration not found in manifest');
  }
  const clientId = oauth2Manifest.client_id;
  const scopes = oauth2Manifest.scopes;
  if (!scopes) {
    throw new Error('Scopes not found in OAuth2 configuration');
  }

  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&response_type=token&scope=${encodeURIComponent(scopes.join(' '))}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({interactive: true, url: authUrl});
  if (!responseUrl) {
    throw new Error('Failed to get response URL from auth flow');
  }

  const searchParams = new URL(responseUrl.replace(/#/, '?')).searchParams;
  const token = searchParams.get('access_token');
  if (!token) {
    throw new Error('Failed to get access token from auth response');
  }

  const auth = getAuth();
  const credential = GoogleAuthProvider.credential(null, token);

  const userCredential = await signInWithCredential(auth, credential);
  const idToken = await userCredential.user.getIdToken();
  await chrome.storage.local.set({ idToken });

  try {
    const response = await fetch('https://request-ai.mogeko6347.workers.dev', {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`APIリクエストに失敗しました: ${response.status} ${response.text()}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('認証エラーが発生しました:', error instanceof Error ? error.message : '不明なエラー');
    throw error; // 上位のエラーハンドリングに委ねる
  }

  sendResponse({ success: true });
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'signIn') {
    signIn(sendResponse);
    return true;
  }
});