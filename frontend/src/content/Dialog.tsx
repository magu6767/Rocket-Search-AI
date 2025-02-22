import React, { useState, useEffect } from 'react';
import { Loader } from '@mantine/core';

interface DialogProps {
    selectedText: string;
    contextData: {
        pageTitle: string;
        heading: string | null;
        before: string;
        after: string;
    };
}

type AnalysisStatus = 'loading' | 'error' | 'success' | 'needLogin' | 'loggingIn';

export const Dialog: React.FC<DialogProps> = ({selectedText, contextData}) => {
    const [status, setStatus] = useState<AnalysisStatus>('loading');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleLogin = async () => {
        try {
            setStatus('loggingIn');
            const result = await chrome.runtime.sendMessage({ action: 'signIn' });
            
            if (result.success) {
                await fetchAnalysis();
            } else {
                throw new Error('ログインに失敗しました');
            }
        } catch (err) {
            setStatus('error');
            setErrorMessage('ログインに失敗しました。もう一度お試しください。');
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
        if (status !== 'needLogin') {
            fetchAnalysis();
        }
    }, [selectedText, contextData]);

    const renderGoogleButton = () => (
        <button
            onClick={handleLogin}
            style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                opacity: status === 'loggingIn' ? 0.7 : 1,
                pointerEvents: status === 'loggingIn' ? 'none' : 'auto'
            }}
            disabled={status === 'loggingIn'}
        >
            <img 
                src={chrome.runtime.getURL('src/content/web_neutral_sq_SI.svg')}
                alt="Googleでログイン"
            />
        </button>
    );

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Loader size="md" />
                        <div style={{ marginTop: '10px', color: '#666' }}>分析中...</div>
                    </div>
                );

            case 'loggingIn':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ marginBottom: '15px', color: '#666' }}>
                            Googleアカウントでログインしています...
                        </div>
                        <Loader size="sm" />
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
                        {errorMessage.includes('ログイン') && (
                            <div style={{ marginTop: '15px', textAlign: 'center' }}>
                                {renderGoogleButton()}
                            </div>
                        )}
                    </div>
                );

            case 'needLogin':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ marginBottom: '15px', color: '#666' }}>
                            分析を行うにはログインが必要です
                        </div>
                        {renderGoogleButton()}
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