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

export const Dialog: React.FC<DialogProps> = ({selectedText, contextData}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setIsLoading(true);
            setError(null);
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
                    throw new Error(response.message);
                }

                setAnalysisResult(response.result);
            } catch (err) {
                setError(err instanceof Error ? err.message : '分析中にエラーが発生しました');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalysis();
    }, [selectedText, contextData]);

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
                <div style={{ marginTop: '20px' }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <Loader size="md" />
                            <div style={{ marginTop: '10px', color: '#666' }}>分析中...</div>
                        </div>
                    ) : error ? (
                        <div style={{ 
                            padding: '10px', 
                            backgroundColor: '#fff3f3', 
                            color: '#d63031',
                            borderRadius: '4px',
                            marginBottom: '15px' 
                        }}>
                            {error}
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>
        </div>
    );
}; 