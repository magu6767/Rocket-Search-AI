import { useState, useEffect } from 'react';
import { ActionIcon, Box, Popover } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import Dialog from './Dialog';

interface ContextData {
    pageTitle: string;
    heading: string | null;
    before: string;
    after: string;
}

export default function TextSelector() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
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

    useEffect(() => {
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

        document.addEventListener('mouseup', handleTextSelection);
        return () => document.removeEventListener('mouseup', handleTextSelection);
    }, []);

    useClickOutside(() => {
        setIsShowButton(false);
        setIsDialogOpen(false);
    }, null, [button]);

    return (
        <>
            {isShowButton && (
                <Box
                    style={{
                        position: 'absolute',
                        left: `${buttonPosition.x}px`,
                        top: `${buttonPosition.y}px`,
                        zIndex: 2147483646
                    }}
                    ref={setButton}
                >
                    <Popover
                        opened={isDialogOpen}
                        position="bottom"
                        withArrow
                        shadow="md"
                    >
                        <Popover.Target>
                            <ActionIcon
                                variant="filled"
                                color="blue"
                                radius="xl"
                                size="md"
                                onClick={() => setIsDialogOpen(true)}
                                style={{
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    backgroundColor: '#4285f4'
                                }}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                            </ActionIcon>
                        </Popover.Target>
                    </Popover>
                    {isDialogOpen && (
                        <Box>
                            <Dialog 
                                selectedText={selectedText} 
                                contextData={contextData}
                            />
                        </Box>
                    )}
                </Box>
            )}
        </>
    );
};