// テキスト選択時のポップアップボタンを作成
const button = document.createElement('button');
button.textContent = '表示';
button.id = 'text-display-button';
button.style.display = 'none';
document.body.appendChild(button);

// テキスト選択時の処理
document.addEventListener('mouseup', function(e) {
    const selectedText = window.getSelection().toString().trim();
    
    if (selectedText) {
        button.style.display = 'block';
        button.style.position = 'fixed';
        button.style.left = `${e.pageX}px`;
        button.style.top = `${e.pageY}px`;
    } else {
        button.style.display = 'none';
    }
});

// ボタンクリック時の処理
button.addEventListener('click', function() {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        const popup = document.createElement('div');
        popup.className = 'text-display-popup';
        popup.textContent = selectedText;
        
        // ポップアップを表示位置の調整
        popup.style.position = 'fixed';
        popup.style.left = `${button.offsetLeft}px`;
        popup.style.top = `${button.offsetTop + 30}px`;
        
        document.body.appendChild(popup);
        
        // 3秒後にポップアップを消す
        setTimeout(() => {
            popup.remove();
        }, 3000);
        
        button.style.display = 'none';
    }
}); 