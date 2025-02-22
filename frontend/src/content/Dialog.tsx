interface DialogProps {
    selectedText: string;
}

export const Dialog: React.FC<DialogProps> = ({selectedText}) => {

    return (
        <div
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
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
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