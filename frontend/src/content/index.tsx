import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import TextSelector from './TextSelector';
import { StrictMode } from 'react';
// Shadow DOMのルート要素を作成
const contentRoot = document.createElement('text-extension-root');
document.body.appendChild(contentRoot);

// Shadow DOMを作成
const shadowRoot = contentRoot.attachShadow({ mode: 'open' });

// Shadow DOM内のReactルート要素を作成
const shadowWrapper = document.createElement('div');
shadowWrapper.id = 'text-extension-wrapper';
shadowWrapper.style.position = 'absolute';
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
    <StrictMode>
        <MantineProvider>
            <TextSelector />
        </MantineProvider>
    </StrictMode>
); 