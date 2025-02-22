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
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '5px' }}>
                        ページ: {contextData.pageTitle}
                        {contextData.heading && <span> | 見出し: {contextData.heading}</span>}
                    </div>
                    <div style={{ color: '#666' }}>{contextData.before}</div>
                    <div style={{ margin: '10px 0', fontWeight: 'bold' }}>{selectedText}</div>
                    <div style={{ color: '#666' }}>{contextData.after}</div>
                </div>
                <button
                    onClick={() => {
                        console.log('コンテキストデータ:', { selectedText, ...contextData });
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