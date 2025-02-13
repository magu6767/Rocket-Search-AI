// Cloudflare Workersを通じてGemini APIを呼び出す関数
async function fetchDictionaryData(text) {
    const WORKER_URL = 'https://request-ai.mogeko6347.workers.dev';
    
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

        return await response.json();
    } catch (error) {
        return {
            error: true,
            message: error.message || 'APIの呼び出し中にエラーが発生しました'
        };
    }
}

// コンテンツスクリプトからのメッセージを処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchDictionary') {
        fetchDictionaryData(request.text)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ error: true, message: error.message }));
        return true; // 非同期レスポンスのために必要
    }
});
