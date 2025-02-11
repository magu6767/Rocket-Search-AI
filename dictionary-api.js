// 辞書APIを呼び出す関数
async function fetchDictionaryData(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (!response.ok) {
            throw new Error('単語が見つかりませんでした');
        }
        const data = await response.json();
        return formatDictionaryResponse(data);
    } catch (error) {
        return {
            error: true,
            message: error.message || '辞書の検索中にエラーが発生しました'
        };
    }
}

// APIレスポンスを整形する関数
function formatDictionaryResponse(data) {
    if (!data || !data[0]) {
        return {
            error: true,
            message: 'データの形式が不正です'
        };
    }

    const word = data[0];
    let formattedContent = '';

    // 見出し語と音声記号
    formattedContent += `<h3>${word.word}</h3>`;
    if (word.phonetic) {
        formattedContent += `<p class="phonetic">${word.phonetic}</p>`;
    }

    // 意味の一覧
    word.meanings.forEach(meaning => {
        formattedContent += `<div class="meaning">`;
        formattedContent += `<p class="part-of-speech">${meaning.partOfSpeech}</p>`;
        
        // 定義
        meaning.definitions.slice(0, 3).forEach(def => {
            formattedContent += `<div class="definition">`;
            formattedContent += `<p>・${def.definition}</p>`;
            if (def.example) {
                formattedContent += `<p class="example">例: ${def.example}</p>`;
            }
            formattedContent += `</div>`;
        });
        
        // 同意語（最大3つまで）
        if (meaning.synonyms && meaning.synonyms.length > 0) {
            formattedContent += `<p class="synonyms">同意語: ${meaning.synonyms.slice(0, 3).join(', ')}</p>`;
        }
        
        formattedContent += `</div>`;
    });

    return {
        error: false,
        content: formattedContent
    };
}

window.fetchDictionaryData = fetchDictionaryData;