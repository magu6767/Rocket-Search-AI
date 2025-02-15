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
  const token = await new Promise<string>((resolve) => {
    chrome.identity.getAuthToken({ 'interactive': true }, (token) => {
      if (token) resolve(token);
    });
  });

  const auth = getAuth();
  const credential = GoogleAuthProvider.credential(null, token);

  const userCredential = await signInWithCredential(auth, credential);

  console.log(userCredential);
  sendResponse({ success: true });
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'signIn') {
    signIn(sendResponse);
    return true;
  }
});