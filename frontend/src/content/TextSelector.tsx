import { useState, useEffect } from 'react';
import { Box, Group } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { IoRocketSharp } from "react-icons/io5";
import Dialog from './Dialog';

interface ContextData {
    pageTitle: string;
    heading: string | null;
    before: string;
    after: string;
}

export default function TextSelector() {
    const [isShowDialog, setIsShowDialog] = useState(false);
    const [isShowButton, setIsShowButton] = useState(false);
    const [button, setButton] = useState<HTMLDivElement | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
    const [contextData, setContextData] = useState<ContextData>({
        pageTitle: '',
        heading: null,
        before: '',
        after: ''
    });

    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        
        // クリーンアップ関数でイベントリスナーを削除
        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
        };
    }, []); // 空の依存配列で一度だけ実行

    useClickOutside(() => {
        setIsShowButton(false);
        setIsShowDialog(false);
    }, null, [button]);

    const getContextualText = (selection: Selection): ContextData => {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        const pageTitle = document.title;
        
        let contextElement: Node | null = container;
        while (contextElement && contextElement.nodeType === Node.TEXT_NODE) {
            contextElement = contextElement.parentElement;
        }
        
        let heading: string | null = null;
        let currentElement = contextElement;
        while (currentElement && !heading) {
            if (currentElement instanceof Element && currentElement.previousElementSibling) {
                const prevElement = currentElement.previousElementSibling;
                if (prevElement.tagName.match(/^H[1-6]$/)) {
                    heading = prevElement.textContent;
                    break;
                }
            }
            currentElement = currentElement instanceof Element ? currentElement.parentElement : null;
        }
        
        const beforeRange = document.createRange();
        if (contextElement) {
            beforeRange.setStartBefore(contextElement);
            beforeRange.setEnd(range.startContainer, range.startOffset);
        }
        
        const afterRange = document.createRange();
        if (contextElement) {
            afterRange.setStart(range.endContainer, range.endOffset);
            afterRange.setEndAfter(contextElement);
        }
        
        return {
            pageTitle: pageTitle,
            heading: heading,
            before: beforeRange.toString().trim().slice(-150),
            after: afterRange.toString().trim().slice(0, 150)
        };
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const text = selection.toString().trim();
            setSelectedText(text);
            setButtonPosition({
                x: rect.left,
                y: rect.bottom + window.scrollY
            });
            setContextData(getContextualText(selection));
            setIsShowButton(true);
        }
    };

    return (
        <>
            {isShowButton && (
                <Group
                    style={{
                        position: 'absolute',
                        left: `${buttonPosition.x}px`,
                        top: `${buttonPosition.y}px`,
                        zIndex: 2147483646,
                    }}
                    ref={setButton}
                >
                    <button
                        style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 8px rgba(0,0,0,0.1)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        }}
                        onClick={() => setIsShowDialog(true)}
                        // アイコンボタンをマウスオーバーした時のエフェクト
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                    >
                        <IoRocketSharp 
                            size={20}
                            style={{
                                color: 'black',
                                strokeWidth: 1.5
                            }}
                        />
                    </button>
                    {isShowDialog && (
                        <Box>
                            <Dialog 
                                selectedText={selectedText} 
                                contextData={contextData}
                            />
                        </Box>
                    )}
                </Group>
            )}
        </>
    );
};