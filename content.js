// テキスト選択時のポップアップボタンを作成
const button = document.createElement('button');
button.textContent = 'AIに聞く';
button.id = 'text-display-button';
button.style.display = 'none';
document.body.appendChild(button);

// 選択されたテキストの前後の文脈を取得する関数
function getContextualText(selection) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // ページタイトルを取得
    const pageTitle = document.title;
    
    // 選択されたテキストを含む最も近い段落やセクションを探す
    let contextElement = container;
    while (contextElement && contextElement.nodeType === Node.TEXT_NODE) {
        contextElement = contextElement.parentElement;
    }
    
    // 見出しを探す
    let heading = null;
    let currentElement = contextElement;
    while (currentElement && !heading) {
        if (currentElement.previousElementSibling) {
            const prevElement = currentElement.previousElementSibling;
            if (prevElement.tagName.match(/^H[1-6]$/)) {
                heading = prevElement.textContent;
                break;
            }
        }
        currentElement = currentElement.parentElement;
    }
    
    // 前後のテキストを取得
    const beforeRange = document.createRange();
    beforeRange.setStartBefore(contextElement);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    
    const afterRange = document.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEndAfter(contextElement);
    
    return {
        pageTitle: pageTitle,
        heading: heading,
        before: beforeRange.toString().trim().slice(-150),  // 前の150文字
        selected: selection.toString().trim(),
        after: afterRange.toString().trim().slice(0, 150)   // 後ろの150文字
    };
}

// クリックされた要素がボタンまたはポップアップでない場合に、ボタンとポップアップを非表示にする
document.addEventListener('mousedown', function(e) {
    if (e.target !== button && !e.target.closest('.text-display-popup')) {
        button.style.display = 'none';
        const popup = document.querySelector('.text-display-popup');
        if (popup) {
            popup.remove();
        }
    }
});

// テキスト選択時の処理
document.addEventListener('mouseup', function(e) {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        button.style.display = 'block';
        button.style.position = 'absolute';
        button.style.left = `${rect.left + window.scrollX}px`;
        button.style.top = `${rect.bottom + window.scrollY}px`;
    }
});

// ボタンクリック時の処理
button.addEventListener('click', async function() {
    const selection = window.getSelection();
    if (selection.toString().trim()) {
        // ローディング表示を作成
        const popup = document.createElement('div');
        popup.className = 'text-display-popup';
        popup.innerHTML = '<p class="loading">検索中...</p>';
        
        // ポップアップの位置をボタンの直下に固定
        const buttonRect = button.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.left = `${buttonRect.left + window.scrollX}px`;
        popup.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
        
        document.body.appendChild(popup);
        
        // 文脈を含むテキストを取得
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
        
        // API呼び出し
        const result = await fetchDictionaryData(contextText);
        
        if (result.error) {
            popup.innerHTML = `<p class="error">${result.message}</p>`;
        } else {
            popup.innerHTML = result.content;
        }
    }
});