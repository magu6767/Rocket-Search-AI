// テキスト選択時のポップアップボタンを作成
const button = document.createElement('button');
button.textContent = '表示';
button.id = 'text-display-button';
button.style.display = 'none';
document.body.appendChild(button);

// クリックされた要素がボタンまたはポップアップでない場合に、ボタンとポップアップを非表示にする
document.addEventListener('mousedown', function(e) {
    if (e.target !== button) {
        button.style.display = 'none';
    }
    const popup = document.querySelector('.text-display-popup');
    if (popup && e.target !== popup) {
        popup.remove();
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
button.addEventListener('click', function() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        const popup = document.createElement('div');
        popup.className = 'text-display-popup';
        popup.textContent = selectedText;
        
        // ポップアップの位置をボタンの直下に固定
        const buttonRect = button.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.left = `${buttonRect.left + window.scrollX}px`;
        popup.style.top = `${buttonRect.bottom + window.scrollY + 5}px`; // ボタンの下に5pxの余白を追加
        
        document.body.appendChild(popup);
    }
});