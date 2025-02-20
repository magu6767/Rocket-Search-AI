import React, { useState, useEffect } from 'react';

export const TextSelector: React.FC = () => {
    const [popupContent, setPopupContent] = useState<string | null>(null);

    useEffect(() => {
        const handleMouseUp = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                const contextText = selection.toString().trim();
                setPopupContent(`選択されたテキスト: ${contextText}`);
            } else {
                setPopupContent(null);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

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
                        zIndex: 2147483647
                    }}
                >
                    {popupContent}
                </div>
            )}
        </>
    );
};
