import React from 'react';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedText: string;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, selectedText }) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 2147483647,
            }}
            onClick={onClose}
        >
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
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        right: '10px',
                        top: '10px',
                        border: 'none',
                        background: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                    }}
                >
                    ×
                </button>
                <h2 style={{ marginTop: 0, marginBottom: '15px' }}>選択されたテキスト</h2>
                <div style={{ marginBottom: '15px' }}>{selectedText}</div>
                <button
                    onClick={() => {
                        console.log('選択されたテキスト:', selectedText);
                    }}
                    style={{
                        backgroundColor: '#4285f4',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}
                >
                    コンソールに表示
                </button>
            </div>
        </div>
    );
}; 