import { marked } from 'marked';

interface ContextData {
    pageTitle: string;
    heading: string | null;
    before: string;
    selected: string;
    after: string;
}

interface DictionaryResponse {
    error: boolean;
    message?: string;
    content?: string;
}

// テキスト選択時のポップアップボタンを作成
const button = document.createElement('button');
button.textContent = 'AIに聞く';
button.id = 'text-display-button';
button.style.display = 'none';
document.body.appendChild(button);

// バックグラウンドスクリプトを通じてGemini APIを呼び出す関数
async function fetchDictionaryData(text: string): Promise<DictionaryResponse> {
    try {
        if (text.length > 10000) {
            return {
                error: true,
                message: '選択されたテキストが長すぎます'
            };
        }

        const response = await chrome.runtime.sendMessage({
            action: 'fetchDictionary',
            text: text
        });

        if (response.error) {
            throw new Error(response.message);
        }

        const responseText = response.result;
        const formattedContent = `
            <div class="gemini-response">
                <h3>分析結果</h3>
                <div class="markdown-content">${marked.parse(responseText)}</div>
            </div>
        `;

        return {
            error: false,
            content: formattedContent
        };
    } catch (error) {
        return {
            error: true,
            message: error instanceof Error ? error.message : 'APIの呼び出し中にエラーが発生しました'
        };
    }
}

// 選択されたテキストの前後の文脈を取得する関数
function getContextualText(selection: Selection): ContextData {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    const pageTitle = document.title;
    
    let contextElement: Node | null = container;
    while (contextElement && contextElement.nodeType === Node.TEXT_NODE) {
        contextElement = contextElement.parentElement;
    }
    
    let heading: string | null = null;
    let currentElement = contextElement;
    while (currentElement && !heading) {
        if (currentElement instanceof Element && currentElement.previousElementSibling) {
            const prevElement = currentElement.previousElementSibling;
            if (prevElement.tagName.match(/^H[1-6]$/)) {
                heading = prevElement.textContent;
                break;
            }
        }
        currentElement = currentElement instanceof Element ? currentElement.parentElement : null;
    }
    
    const beforeRange = document.createRange();
    if (contextElement) {
        beforeRange.setStartBefore(contextElement);
        beforeRange.setEnd(range.startContainer, range.startOffset);
    }
    
    const afterRange = document.createRange();
    if (contextElement) {
        afterRange.setStart(range.endContainer, range.endOffset);
        afterRange.setEndAfter(contextElement);
    }
    
    return {
        pageTitle: pageTitle,
        heading: heading,
        before: beforeRange.toString().trim().slice(-150),
        selected: selection.toString().trim(),
        after: afterRange.toString().trim().slice(0, 150)
    };
}

// イベントリスナーの設定
document.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as Element;
    if (target !== button && !target.closest('.text-display-popup')) {
        button.style.display = 'none';
        const popup = document.querySelector('.text-display-popup');
        if (popup) {
            popup.remove();
        }
    }
});

document.addEventListener('mouseup', (_e: MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        button.style.display = 'block';
        button.style.position = 'absolute';
        button.style.left = `${rect.left + window.scrollX}px`;
        button.style.top = `${rect.bottom + window.scrollY}px`;
    }
});

button.addEventListener('click', async () => {
    const startTime = performance.now();
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
        const popup = document.createElement('div');
        popup.className = 'text-display-popup';
        popup.innerHTML = '<p class="loading">検索中...</p>';
        
        const buttonRect = button.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.left = `${buttonRect.left + window.scrollX}px`;
        popup.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        
        document.body.appendChild(popup);
        
        const contextData = getContextualText(selection);
        const contextText = `
選択されたテキスト:${contextData.selected}
ページタイトル: ${contextData.pageTitle}
見出し: ${contextData.heading || '(見出しなし)'}
前の文脈:
${contextData.before}
後の文脈:
${contextData.after}
        `.trim();
        
        const result = await fetchDictionaryData(contextText);
        
        if (result.error) {
            popup.innerHTML = `<p class="error">${result.message}</p>`;
        } else {
            popup.innerHTML = result.content || '';
        }

        const endTime = performance.now();
        console.log(`処理時間: ${endTime - startTime}ミリ秒`);
    }
});
