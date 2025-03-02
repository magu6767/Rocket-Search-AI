import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { IoRocketSharp } from "react-icons/io5";

interface DialogProps {
    selectedText: string;
    contextData: {
        pageTitle: string;
        heading: string | null;
        before: string;
        after: string;
    };
}

type AnalysisStatus = 'loading' | 'error' | 'success' | 'needLogin' | 'loggingIn' | 'streaming';

export default function Dialog({selectedText, contextData}: DialogProps) {
    const [status, setStatus] = useState<AnalysisStatus>('loading');
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (status !== 'needLogin') {
            fetchAnalysis();
        }

        // ストリームデータの受信リスナーを設定
        const handleStreamChunk = (message: any) => {
            if (message.action === 'streamChunk') {
                setStatus('streaming');
                setAnalysisResult(prev => prev + message.chunk);
            } else if (message.action === 'streamEnd') {
                setStatus('success');
            }
        };

        chrome.runtime.onMessage.addListener(handleStreamChunk);

        return () => {
            chrome.runtime.onMessage.removeListener(handleStreamChunk);
        };
    }, [selectedText, contextData]);

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
        setAnalysisResult('');
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

            if (!response.stream) {
                setAnalysisResult(response.result);
                setStatus('success');
            }
            // ストリームの場合は、onMessageリスナーで処理
        } catch (err) {
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
        }
    };

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
                    <div style={{ textAlign: 'center', padding: '20px', color: '#333' }}>
                        <div style={{ position: 'relative', width: '40px', height: '40px', margin: '0 auto' }}>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                border: '3px solid #f3f3f3',
                                borderTop: '3px solid #646cff',
                                animation: 'spin 1s linear infinite'
                            }} />
                        </div>
                        <div style={{ 
                            marginTop: '10px', 
                            color: '#666',
                            animation: 'fadeInOut 1.5s ease-in-out infinite'
                        }}>
                            分析中...
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '20px',
                            color: '#666',
                            fontSize: '0.8em'
                        }}>
                            Rocket Search AIに個人情報や機密情報を送らないでください。
                        </div>
                        <style>
                            {`
                                @keyframes spin {
                                    from { transform: translate(-50%, -50%) rotate(0deg); }
                                    to { transform: translate(-50%, -50%) rotate(360deg); }
                                }
                                @keyframes fadeInOut {
                                    0% { opacity: 0.4; }
                                    50% { opacity: 1; }
                                    100% { opacity: 0.4; }
                                }
                            `}
                        </style>
                    </div>
                );

            case 'streaming':
            case 'success':
                return (
                    <div style={{ 
                        backgroundColor: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '4px',
                        fontSize: '0.95em',
                        lineHeight: '1.5',
                        color: '#333',
                    }}>
                        <ReactMarkdown>{analysisResult}</ReactMarkdown>
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

            case 'loggingIn':
                return (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ marginBottom: '15px', color: '#666' }}>
                            Googleアカウントでログインしています...
                        </div>
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
                    width: '400px',
                    position: 'relative',
                    color: '#333',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                    fontFamily: 'Arial, sans-serif',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                }}>
                    <IoRocketSharp size={30} />
                </div>
                {renderContent()}
            </div>
        </div>
    );
}; 