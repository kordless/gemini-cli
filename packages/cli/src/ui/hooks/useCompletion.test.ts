/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the FileDiscoveryService to avoid actual file system calls in most tests
vi.mock('@google/gemini-cli-core', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@google/gemini-cli-core')>();
  return {
    ...original,
    FileDiscoveryService: vi.fn().mockImplementation(() => ({
      glob: vi.fn().mockResolvedValue([]),
      findFiles: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe('useCompletion', () => {
  let testRootDir: string;

  beforeEach(async () => {
    testRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(testRootDir, { recursive: true, force: true });
  });

  it('should be a placeholder test', () => {
    expect(true).toBe(true);
  });
});
