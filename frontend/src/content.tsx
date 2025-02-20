import React from 'react';
import { createRoot } from 'react-dom/client';
import { TextSelector } from './components/TextSelector';
import './content.css';

// Shadow DOMのルート要素を作成
const contentRoot = document.createElement('text-extension-root');
contentRoot.style.display = 'contents';
document.body.appendChild(contentRoot);

// Shadow DOMを作成
const shadowRoot = contentRoot.attachShadow({ mode: 'open' });

// スタイルシートを追加
const styleSheet = document.createElement('link');
styleSheet.rel = 'stylesheet';
shadowRoot.appendChild(styleSheet);

// Shadow DOM内のReactルート要素を作成
const shadowWrapper = document.createElement('div');
shadowWrapper.id = 'text-extension-wrapper';
shadowWrapper.style.position = 'fixed';
shadowWrapper.style.top = '0';
shadowWrapper.style.left = '0';
shadowWrapper.style.width = '100%';
shadowWrapper.style.height = '0';
shadowWrapper.style.overflow = 'visible';
shadowWrapper.style.zIndex = '2147483647'; // 最大のz-index値
shadowRoot.appendChild(shadowWrapper);

// Reactアプリケーションをマウント
const root = createRoot(shadowWrapper);
root.render(
    <React.StrictMode>
        <TextSelector />
    </React.StrictMode>
); 