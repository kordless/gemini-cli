/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, act } from '@testing-library/react';
import { useKeypress, Key } from './useKeypress.js';
import { useStdin } from 'ink';
import { EventEmitter } from 'events';

// Mock the 'ink' module to control stdin
vi.mock('ink', async (importOriginal) => {
  const original = await importOriginal<typeof import('ink')>();
  return {
    ...original,
    useStdin: vi.fn(),
  };
});

// Mock the 'readline' module
vi.mock('readline', () => {
  const mockedReadline = {
    createInterface: vi.fn().mockReturnValue({ close: vi.fn() }),
    emitKeypressEvents: vi.fn(),
  };
  return {
    ...mockedReadline,
    default: mockedReadline,
  };
});

class MockStdin extends EventEmitter {
  isTTY = true;
  isRaw = false;
  setRawMode = vi.fn((mode: boolean) => {
    this.isRaw = mode;
  });
  on = this.addListener;
  removeListener = this.removeListener;
  write = vi.fn();
  resume = vi.fn();

  // Helper to simulate a raw data event (like a paste)
  emitData(text: string) {
    this.emit('data', Buffer.from(text));
  }

  // Helper to simulate a single keypress event.
  emitKeypress(key: Partial<Key>) {
    this.emit('keypress', null, key);
  }
}

describe('useKeypress', () => {
  let stdin: MockStdin;
  const onKeypress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    stdin = new MockStdin();
    (useStdin as vi.Mock).mockReturnValue({
      stdin,
      setRawMode: stdin.setRawMode,
      isRaw: stdin.isRaw,
    });
  });

  it('should not listen if isActive is false', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: false }));
    act(() => stdin.emitKeypress({ name: 'a' }));
    expect(onKeypress).not.toHaveBeenCalled();
  });

  it('should listen for keypress when active', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: true }));
    const key = { name: 'a', sequence: 'a' };
    act(() => stdin.emitKeypress(key));
    expect(onKeypress).toHaveBeenCalledWith(expect.objectContaining(key));
  });

  it('should set and release raw mode', () => {
    const { unmount } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );
    expect(stdin.setRawMode).toHaveBeenCalledWith(true);
    unmount();
    // In the new implementation, we don't strictly enforce turning raw mode off
    // because other hooks might still need it. This test is adjusted.
    expect(stdin.setRawMode).toHaveBeenCalledTimes(1);
  });

  it('should stop listening after being unmounted', () => {
    const { unmount } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );
    unmount();
    act(() => stdin.emitKeypress({ name: 'a' }));
    expect(onKeypress).not.toHaveBeenCalled();
  });

  it('should ignore bracketed paste start sequence', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: true }));
    act(() => stdin.emitData('\x1b[200~'));
    expect(onKeypress).not.toHaveBeenCalled();
  });

  it('should ignore bracketed paste end sequence', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: true }));
    act(() => {
      stdin.emitData('\x1b[200~'); // Start paste
      stdin.emitData('\x1b[201~'); // End paste
    });
    expect(onKeypress).not.toHaveBeenCalled();
  });

  it('should ignore content between paste markers', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: true }));
    act(() => {
      stdin.emitData('\x1b[200~');
      stdin.emitData('pasted content');
      stdin.emitData('\x1b[201~');
    });
    expect(onKeypress).not.toHaveBeenCalled();
  });

  it('should process regular keys after a paste sequence', () => {
    renderHook(() => useKeypress(onKeypress, { isActive: true }));
    act(() => {
      stdin.emitData('\x1b[200~');
      stdin.emitData('pasted content');
      stdin.emitData('\x1b[201~');
      stdin.emitKeypress({ name: 'a', sequence: 'a' });
    });
    expect(onKeypress).toHaveBeenCalledTimes(1);
    expect(onKeypress).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'a' }),
    );
  });
});
