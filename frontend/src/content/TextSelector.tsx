import React, { useState, useEffect } from 'react';

export const TextSelector: React.FC = () => {
    const [selectedText, setSelectedText] = useState<string>('');
    const [popupContent, setPopupContent] = useState<string | null>(null);

    useEffect(() => {
        const handleMouseUp = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                const contextText = selection.toString().trim();
                setSelectedText(contextText);
                setPopupContent(`選択されたテキスト: ${contextText}`);
            } else {
                setSelectedText('');
                setPopupContent(null);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleConsoleLog = () => {
        console.log('選択されたテキスト:', selectedText);
    };

    return (
        <>
            {popupContent && (
                <div
                    className="text-display-popup"
                    style={{
                        position: 'fixed',
                        top: '10px',
                        right: '10px',
                        backgroundColor: 'white',
                        padding: '10px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        zIndex: 2147483647,
                        borderRadius: '4px',
                        minWidth: '200px'
                    }}
                >
                    <div style={{ marginBottom: '10px' }}>{popupContent}</div>
                    <button
                        onClick={handleConsoleLog}
                        style={{
                            backgroundColor: '#4285f4',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        コンソールに表示
                    </button>
                </div>
            )}
        </>
    );
};
