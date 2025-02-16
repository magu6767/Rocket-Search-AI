import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Chrome拡張機能の練習',
  version: '1.0.0',
  description: 'Zenn投稿するChrome拡張機能のサンプルです。',
  action: {
    default_popup: 'popup.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content.ts'],
    },
  ],
  background: {
    service_worker: 'src/background.ts',
  },
  permissions: [
    'identity',
    'storage',
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
    sandbox: "sandbox allow-scripts; script-src 'self' https://apis.google.com https://www.gstatic.com https://www.googleapis.com https://securetoken.googleapis.com; object-src 'self'",
  },
  oauth2: { 
    // Google CloudのOAuth 2.0 クライアント ID
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
  },
  // Chromeウェブストアの公開キー
  key: process.env.EXTENSION_PUBLIC_KEY,
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
