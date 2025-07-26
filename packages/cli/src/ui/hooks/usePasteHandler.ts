/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useStdin } from 'ink';
import { useEffect, useRef } from 'react';

const PASTE_START_SEQ = '\x1b[200~';
const PASTE_END_SEQ = '\x1b[201~';

interface PasteHandlerOptions {
  onPaste: (pastedText: string) => void;
  isActive?: boolean;
}

/**
 * A hook that listens for bracketed paste sequences from stdin
 * and calls a handler with the full pasted text.
 *
 * @param onPaste - The callback to execute with the pasted text.
 * @param isActive - Whether the hook should be active.
 */
export const usePasteHandler = ({
  onPaste,
  isActive = true,
}: PasteHandlerOptions) => {
  const { stdin, setRawMode } = useStdin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRaw = (stdin as any).isRaw;
  const isPasting = useRef(false);
  const pasteBuffer = useRef('');

  useEffect(() => {
    if (!stdin || !isActive) {
      return;
    }

    const handleData = (data: Buffer) => {
      const chunk = data.toString();

      if (isPasting.current) {
        if (chunk.endsWith(PASTE_END_SEQ)) {
          pasteBuffer.current += chunk.slice(0, -PASTE_END_SEQ.length);
          if (pasteBuffer.current) {
            onPaste(pasteBuffer.current);
          }
          isPasting.current = false;
          pasteBuffer.current = '';
        } else {
          pasteBuffer.current += chunk;
        }
      } else {
        if (chunk.startsWith(PASTE_START_SEQ)) {
          isPasting.current = true;
          pasteBuffer.current = chunk.slice(PASTE_START_SEQ.length);
          // Check if the entire paste came in one chunk
          if (pasteBuffer.current.endsWith(PASTE_END_SEQ)) {
            pasteBuffer.current = pasteBuffer.current.slice(
              0,
              -PASTE_END_SEQ.length,
            );

            if (pasteBuffer.current) {
              onPaste(pasteBuffer.current);
            }
            isPasting.current = false;
            pasteBuffer.current = '';
          }
        } else {
          // Not a paste, let other handlers process it.
          // This is where the original useKeypress would have been called.
          // We will modify useKeypress to not handle raw text chunks.
        }
      }
    };

    if (isRaw) {
      stdin.on('data', handleData);
    } else {
      setRawMode(true);
      stdin.on('data', handleData);
    }

    return () => {
      stdin.removeListener('data', handleData);
      if (!isRaw) {
        setRawMode(false);
      }
    };
  }, [stdin, isActive, isRaw, setRawMode, onPaste]);
};
