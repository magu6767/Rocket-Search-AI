import React, { useState, useEffect } from 'react';
import { Loader, Button} from '@mantine/core';

interface DialogProps {
    selectedText: string;
    contextData: {
        pageTitle: string;
        heading: string | null;
        before: string;
        after: string;
    };
}

type AnalysisStatus = 'loading' | 'error' | 'success' | 'needLogin';

export const Dialog: React.FC<DialogProps> = ({selectedText, contextData}) => {
    const [status, setStatus] = useState<AnalysisStatus>('loading');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleLogin = async () => {
        try {
            setStatus('loading');
            await chrome.runtime.sendMessage({ action: 'signIn' });
            // ログイン後に分析を再実行
            fetchAnalysis();
        } catch (err) {
            setStatus('error');
            setErrorMessage('ログインに失敗しました');
        }
    };

    const fetchAnalysis = async () => {
        setStatus('loading');
        try {
            const contextText = `
ページタイトル: ${contextData.pageTitle}
見出し: ${contextData.heading || '(見出しなし)'}
前の文脈:
${contextData.before}
選択されたテキスト:
${selectedText}
後の文脈:
${contextData.after}
            `.trim();

            const response = await chrome.runtime.sendMessage({
                action: 'fetchDictionary',
                text: contextText
            });

            if (response.error) {
                if (response.message === '認証が必要です') {
                    setStatus('needLogin');
                } else {
                    setStatus('error');
                    setErrorMessage(response.message);
                }
                return;
            }

            setAnalysisResult(response.result);
            setStatus('success');
        } catch (err) {
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        }
    };

    useEffect(() => {
        fetchAnalysis();
    }, [selectedText, contextData]);

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Loader size="md" />
                        <div style={{ marginTop: '10px', color: '#666' }}>分析中...</div>
                    </div>
                );

            case 'error':
                return (
                    <div style={{ 
                        padding: '15px',
                        backgroundColor: '#fff3f3',
                        color: '#d63031',
                        borderRadius: '4px',
                        marginBottom: '15px'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>エラーが発生しました</div>
                        <div>{errorMessage}</div>
                    </div>
                );

            case 'needLogin':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ marginBottom: '15px', color: '#666' }}>
                            分析を行うにはログインが必要です
                        </div>
                        <Button
                            // leftSection={<IconLogin size={16} />}
                            onClick={handleLogin}
                            variant="filled"
                            color="blue"
                        >
                            ログイン
                        </Button>
                    </div>
                );

            case 'success':
                return (
                    <div style={{ 
                        whiteSpace: 'pre-wrap',
                        backgroundColor: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '4px',
                        fontSize: '0.95em',
                        lineHeight: '1.5'
                    }}>
                        {analysisResult}
                    </div>
                );
        }
    };

    return (
        <div>
            <div
                style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '8px',
                    maxWidth: '500px',
                    width: '90%',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    position: 'relative',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 style={{ marginTop: 0, marginBottom: '15px' }}>分析結果</h2>
                {renderContent()}
            </div>
        </div>
    );
}; 