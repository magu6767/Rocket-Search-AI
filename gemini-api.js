// Gemini APIを呼び出す関数
async function fetchDictionaryData(text) {
    const API_KEY = 'YOUR_API_KEY'; // ここは後でユーザーが設定
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `以下の選択されたテキストを分析して日本語で出力してください。
                        「分析」とは、短い単語なら単純にその意味を調べて詳しく丁寧に解説し、長めの文章ならその内容をわかりやすく解説することです。
                        分脈がわかるように、ページタイトル、見出し、前後の文脈を載せます。あくまで選択したテキストを分析して欲しいので、これらの情報は出力に含めないでください。
${text}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error('APIリクエストに失敗しました');
        }

        const data = await response.json();
        return formatGeminiResponse(data);
    } catch (error) {
        return {
            error: true,
            message: error.message || 'Gemini APIの呼び出し中にエラーが発生しました'
        };
    }
}

// Gemini APIのレスポンスを整形する関数
function formatGeminiResponse(data) {
    if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        return {
            error: true,
            message: 'データの形式が不正です'
        };
    }

    const response = data.candidates[0].content.parts[0].text;
    const formattedContent = `
        <div class="gemini-response">
            <h3>分析結果</h3>
            <div class="markdown-content">${marked.parse(response)}</div>
        </div>
    `;

    return {
        error: false,
        content: formattedContent
    };
}

window.fetchDictionaryData = fetchDictionaryData;