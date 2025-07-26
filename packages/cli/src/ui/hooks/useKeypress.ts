/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';
import readline from 'readline';

export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  paste: boolean; // This will be set by the new paste handler logic
  sequence: string;
}

const PASTE_START_SEQ = '\x1b[200~';
const PASTE_END_SEQ = '\x1b[201~';

/**
 * A hook that listens for keypress events from stdin.
 * It deliberately ignores bracketed paste sequences, which are
 * handled by the dedicated `usePasteHandler` hook.
 *
 * @param onKeypress - The callback function to execute on each keypress.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 */
export function useKeypress(
  onKeypress: (key: Key) => void,
  { isActive }: { isActive: boolean },
) {
  const { stdin, setRawMode } = useStdin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRaw = (stdin as any).isRaw;
  const onKeypressRef = useRef(onKeypress);
  const isPasting = useRef(false);

  useEffect(() => {
    onKeypressRef.current = onKeypress;
  }, [onKeypress]);

  useEffect(() => {
    if (!isActive || !stdin.isTTY) {
      return;
    }

    const handleData = (data: Buffer) => {
      const chunk = data.toString();

      if (chunk === PASTE_START_SEQ) {
        isPasting.current = true;
        return;
      }

      if (chunk === PASTE_END_SEQ) {
        isPasting.current = false;
        return;
      }

      if (isPasting.current) {
        // While pasting, all data is handled by usePasteHandler,
        // so we ignore it here to prevent double processing.
        return;
      }

      // Not pasting, so emit the keypress event for other handlers.
      // The `readline.emitKeypressEvents` will parse the buffer
      // and the 'keypress' event will be fired.
    };

    const handleKeypress = (_: unknown, key: Key) => {
      // When not pasting, forward the key event.
      if (!isPasting.current) {
        onKeypressRef.current({ ...key, paste: false });
      }
    };

    if (!isRaw) {
      setRawMode(true);
    }

    readline.emitKeypressEvents(stdin);
    stdin.on('data', handleData);
    stdin.on('keypress', handleKeypress);

    return () => {
      stdin.removeListener('data', handleData);
      stdin.removeListener('keypress', handleKeypress);
      if (isRaw) {
        setRawMode(false);
      }
    };
  }, [isActive, stdin, setRawMode, isRaw]);
}
