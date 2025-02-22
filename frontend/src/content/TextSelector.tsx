import React, { useState, useEffect } from 'react';
import { Button, Box, Popover } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { Dialog } from './Dialog';

export const TextSelector: React.FC = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isShowButton, setIsShowButton] = useState(false);
    const [button, setButton] = useState<HTMLDivElement | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleTextSelection = () => {
            const selection = window.getSelection();
            if (selection && selection.toString().trim() !== '') {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelectedText(selection.toString());
                setButtonPosition({
                    x: rect.left,
                    y: rect.bottom + window.scrollY
                });
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
                            <Button 
                                size="xs"
                                onClick={() => setIsDialogOpen(true)}
                            >
                                選択テキストを処理
                            </Button>
                        </Popover.Target>
                    </Popover>
                    {isDialogOpen && (
                        <Box>
                            <Dialog selectedText={selectedText} />
                        </Box>
                    )}
                </Box>
            )}
        </>
    );
};