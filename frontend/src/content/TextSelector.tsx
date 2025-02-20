import React, { useState, useEffect } from 'react';
import { Dialog } from './Dialog';

export const TextSelector: React.FC = () => {
    const [selectedText, setSelectedText] = useState<string>('');
    const [isShowButton, setIsShowButton] = useState(false);
    const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const handleMouseUp = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                const text = selection.toString().trim();
                setSelectedText(text);
                
                // 選択範囲の位置を取得
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // ボタンの位置を選択範囲の左下に設定
                setButtonPosition({
                    x: rect.left + window.scrollX,
                    y: rect.bottom + window.scrollY
                });
                setIsShowButton(true);
            } else {
                setIsShowButton(false);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const handleButtonClick = () => {
        setIsDialogOpen(true);
    };

    return (
        <>
            {isShowButton && (
                <button
                    className="text-selector-button"
                    onClick={handleButtonClick}
                    style={{
                        position: 'absolute',
                        left: `${buttonPosition.x}px`,
                        top: `${buttonPosition.y}px`,
                        transform: 'translate(8px, 8px)', // ボタンを少し右下にオフセット
                        backgroundColor: '#4285f4',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        zIndex: 2147483647,
                        whiteSpace: 'nowrap', // ボタンのテキストを1行に
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    }}
                >
                    テキストを分析
                </button>
            )}
            <Dialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                selectedText={selectedText}
            />
        </>
    );
}; 