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
                        text: `以下のテキストを分析して日本語で出力してください。短い単語ならその意味を、文章ならその内容のわかりやすい解説をして下さい。：\n${text}`
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
            <p>${response.replace(/\n/g, '<br>')}</p>
        </div>
    `;

    return {
        error: false,
        content: formattedContent
    };
}

window.fetchDictionaryData = fetchDictionaryData;