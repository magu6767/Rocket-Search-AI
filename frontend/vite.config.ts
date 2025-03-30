import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin';
import dotenv from 'dotenv';

// .envファイルを読み込む
dotenv.config();

const manifest = defineManifest({
  manifest_version: 3,
  name: '__MSG_appName__',
  version: '1.0.1',
  description: '__MSG_appDescription__',
  default_locale: 'en',
  icons: {
    "16": "src/assets/rocket-sharp-icon16.png",
    "32": "src/assets/rocket-sharp-icon32.png",
    "48": "src/assets/rocket-sharp-icon48.png",
    "128": "src/assets/rocket-sharp-icon128.png"
  },
  action: {
    default_popup: 'src/popup/popup.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
    },
  ],
  background: {
    service_worker: 'src/background/index.ts',
  },
  permissions: [
    'identity',
    'storage',
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
  web_accessible_resources: [
    {
      resources: ['src/content/web_neutral_sq_SI.svg'],
      matches: ['<all_urls>'],
    },
  ],
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
