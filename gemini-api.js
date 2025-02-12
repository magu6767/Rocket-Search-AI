// Cloudflare Workersを通じてGemini APIを呼び出す関数
async function fetchDictionaryData(text) {
    const WORKER_URL = 'http://localhost:8787'; // 開発時のエンドポイント
    // const WORKER_URL = 'https://your-worker.your-subdomain.workers.dev'; // 本番用エンドポイント
    
    try {
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error('APIリクエストに失敗しました');
        }

        const data = await response.json();
        return formatGeminiResponse(data);
    } catch (error) {
        return {
            error: true,
            message: error.message || 'APIの呼び出し中にエラーが発生しました'
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