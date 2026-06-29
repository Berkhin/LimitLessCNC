import { describe, expect, it } from 'vitest';
import { isVersionChanged } from './stateUpdate';
import type { StateUpdatedPayload } from './types';

function makePayload(
  version: number,
  approvalContextChanged = false,
  publishContextChanged = false,
): StateUpdatedPayload {
  return {
    document: { id: 'doc-1', title: 'T', body: 'B', version, status: 'draft' },
    approvalContextChanged,
    publishContextChanged,
  };
}

describe('isVersionChanged', () => {
  it('is false when the snapshot version matches the held version', () => {
    expect(isVersionChanged(makePayload(3), 3)).toBe(false);
  });

  it('is true when the snapshot version differs from the held version', () => {
    expect(isVersionChanged(makePayload(4), 3)).toBe(true);
  });

  it('ignores the context-changed flags entirely (the old heuristic would not)', () => {
    // Both flags set but the version is unchanged: NOT a version change. The
    // previous "approvalContextChanged && publishContextChanged" heuristic would
    // have wrongly reported a version bump here.
    expect(isVersionChanged(makePayload(3, true, true), 3)).toBe(false);
    // Conversely, a version change with no flags set is still detected.
    expect(isVersionChanged(makePayload(9, false, false), 3)).toBe(true);
  });
});
