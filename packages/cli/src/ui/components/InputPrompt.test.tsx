/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { InputPrompt, InputPromptProps } from './InputPrompt.js';
import type { TextBuffer } from './shared/text-buffer.js';
import { Config } from '@google/gemini-cli-core';
import * as path from 'path';
import {
  CommandContext,
  SlashCommand,
  CommandKind,
} from '../commands/types.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useShellHistory,
  UseShellHistoryReturn,
} from '../hooks/useShellHistory.js';
import { useCompletion, UseCompletionReturn } from '../hooks/useCompletion.js';
import {
  useInputHistory,
  UseInputHistoryReturn,
} from '../hooks/useInputHistory.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { useKeypress, Key } from '../hooks/useKeypress.js';
import { usePasteHandler } from '../hooks/usePasteHandler.js';

vi.mock('../hooks/useShellHistory.js');
vi.mock('../hooks/useCompletion.js');
vi.mock('../hooks/useKeypress.js');
vi.mock('../hooks/usePasteHandler.js');
vi.mock('../hooks/useInputHistory.js');

const mockSlashCommands: SlashCommand[] = [
  {
    name: 'clear',
    kind: CommandKind.BUILT_IN,
    description: 'Clear screen',
    action: vi.fn(),
  },
  {
    name: 'memory',
    kind: CommandKind.BUILT_IN,
    description: 'Manage memory',
    subCommands: [
      {
        name: 'show',
        kind: CommandKind.BUILT_IN,
        description: 'Show memory',
        action: vi.fn(),
      },
      {
        name: 'add',
        kind: CommandKind.BUILT_IN,
        description: 'Add to memory',
        action: vi.fn(),
      },
      {
        name: 'refresh',
        kind: CommandKind.BUILT_IN,
        description: 'Refresh memory',
        action: vi.fn(),
      },
    ],
  },
  {
    name: 'chat',
    description: 'Manage chats',
    kind: CommandKind.BUILT_IN,
    subCommands: [
      {
        name: 'resume',
        description: 'Resume a chat',
        kind: CommandKind.BUILT_IN,
        action: vi.fn(),
        completion: async () => ['fix-foo', 'fix-bar'],
      },
    ],
  },
];

describe('InputPrompt', () => {
  let props: InputPromptProps;
  let mockShellHistory: UseShellHistoryReturn;
  let mockCompletion: UseCompletionReturn;
  let mockInputHistory: UseInputHistoryReturn;
  let mockBuffer: TextBuffer;
  let mockCommandContext: CommandContext;
  let keypressHandler: (key: Key) => void;
  let pasteHandler: (text: string) => void;

  const mockedUseShellHistory = vi.mocked(useShellHistory);
  const mockedUseCompletion = vi.mocked(useCompletion);
  const mockedUseInputHistory = vi.mocked(useInputHistory);
  const mockedUseKeypress = vi.mocked(useKeypress);
  const mockedUsePasteHandler = vi.mocked(usePasteHandler);

  beforeEach(() => {
    vi.resetAllMocks();

    mockedUseKeypress.mockImplementation((handler) => {
      keypressHandler = handler;
    });

    mockedUsePasteHandler.mockImplementation(({ onPaste }) => {
      pasteHandler = onPaste;
    });

    mockCommandContext = createMockCommandContext();

    mockBuffer = {
      text: '',
      cursor: [0, 0],
      lines: [''],
      setText: vi.fn((newText: string) => {
        mockBuffer.text = newText;
        mockBuffer.lines = [newText];
        mockBuffer.cursor = [0, newText.length];
        mockBuffer.viewportVisualLines = [newText];
        mockBuffer.allVisualLines = [newText];
      }),
      replaceRangeByOffset: vi.fn(),
      viewportVisualLines: [''],
      allVisualLines: [''],
      visualCursor: [0, 0],
      visualScrollRow: 0,
      handleInput: vi.fn(),
      move: vi.fn(),
      moveToOffset: vi.fn(),
      killLineRight: vi.fn(),
      killLineLeft: vi.fn(),
      openInExternalEditor: vi.fn(),
      newline: vi.fn(),
      backspace: vi.fn(),
      preferredCol: null,
      selectionAnchor: null,
      insert: vi.fn(),
      del: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      replaceRange: vi.fn(),
      deleteWordLeft: vi.fn(),
      deleteWordRight: vi.fn(),
    } as unknown as TextBuffer;

    mockShellHistory = {
      addCommandToHistory: vi.fn(),
      getPreviousCommand: vi.fn().mockReturnValue(null),
      getNextCommand: vi.fn().mockReturnValue(null),
      resetHistoryPosition: vi.fn(),
    };
    mockedUseShellHistory.mockReturnValue(mockShellHistory);

    mockCompletion = {
      suggestions: [],
      activeSuggestionIndex: -1,
      isLoadingSuggestions: false,
      showSuggestions: false,
      visibleStartIndex: 0,
      isPerfectMatch: false,
      navigateUp: vi.fn(),
      navigateDown: vi.fn(),
      resetCompletionState: vi.fn(),
      setActiveSuggestionIndex: vi.fn(),
      setShowSuggestions: vi.fn(),
      handleAutocomplete: vi.fn(),
    };
    mockedUseCompletion.mockReturnValue(mockCompletion);

    mockInputHistory = {
      navigateUp: vi.fn(),
      navigateDown: vi.fn(),
      handleSubmit: vi.fn(),
    };
    mockedUseInputHistory.mockReturnValue(mockInputHistory);

    props = {
      buffer: mockBuffer,
      onSubmit: vi.fn(),
      userMessages: [],
      onClearScreen: vi.fn(),
      config: {
        getProjectRoot: () => path.join('test', 'project'),
        getTargetDir: () => path.join('test', 'project', 'src'),
        getVimMode: () => false,
      } as unknown as Config,
      slashCommands: mockSlashCommands,
      commandContext: mockCommandContext,
      shellModeActive: false,
      setShellModeActive: vi.fn(),
      inputWidth: 80,
      suggestionsWidth: 80,
      focus: true,
    };
  });

  const pressKey = (key: Partial<Key>) => {
    keypressHandler({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '',
      ...key,
    });
  };

  const pasteText = (text: string) => {
    pasteHandler(text);
  };

  it('should call shellHistory.getPreviousCommand on up arrow in shell mode', () => {
    props.shellModeActive = true;
    render(<InputPrompt {...props} />);
    pressKey({ name: 'up' });
    expect(mockShellHistory.getPreviousCommand).toHaveBeenCalled();
  });

  it('should call shellHistory.getNextCommand on down arrow in shell mode', () => {
    props.shellModeActive = true;
    render(<InputPrompt {...props} />);
    pressKey({ name: 'down' });
    expect(mockShellHistory.getNextCommand).toHaveBeenCalled();
  });

  it('should set the buffer text when a shell history command is retrieved', () => {
    props.shellModeActive = true;
    vi.mocked(mockShellHistory.getPreviousCommand).mockReturnValue(
      'previous command',
    );
    render(<InputPrompt {...props} />);
    pressKey({ name: 'up' });
    expect(mockShellHistory.getPreviousCommand).toHaveBeenCalled();
    expect(props.buffer.setText).toHaveBeenCalledWith('previous command');
  });

  it('should call shellHistory.addCommandToHistory on submit in shell mode', () => {
    props.shellModeActive = true;
    mockBuffer.text = 'ls -l';
    render(<InputPrompt {...props} />);
    pressKey({ name: 'return' });
    expect(mockShellHistory.addCommandToHistory).toHaveBeenCalledWith('ls -l');
    expect(props.onSubmit).toHaveBeenCalledWith('ls -l');
  });

  it('should NOT call shell history methods when not in shell mode', () => {
    mockBuffer.text = 'some text';
    render(<InputPrompt {...props} />);
    pressKey({ name: 'up' });
    pressKey({ name: 'down' });
    pressKey({ name: 'return' });

    expect(mockShellHistory.getPreviousCommand).not.toHaveBeenCalled();
    expect(mockShellHistory.getNextCommand).not.toHaveBeenCalled();
    expect(mockShellHistory.addCommandToHistory).not.toHaveBeenCalled();

    expect(mockInputHistory.navigateUp).toHaveBeenCalled();
    expect(mockInputHistory.navigateDown).toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalledWith('some text');
  });

  it('should handle paste events correctly', () => {
    render(<InputPrompt {...props} />);
    pasteText('hello world');
    expect(mockBuffer.insert).toHaveBeenCalledWith('hello world', {
      paste: true,
    });
  });
});
