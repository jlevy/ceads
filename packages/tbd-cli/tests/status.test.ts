/**
 * Tests for status utilities.
 */

import { describe, it, expect } from 'vitest';
import { formatStatus, getStatusIcon, getStatusColor } from '../src/lib/status.js';
import { ICONS, createColors } from '../src/cli/lib/output.js';

describe('getStatusIcon', () => {
  it('returns empty circle for open', () => {
    expect(getStatusIcon('open')).toBe(ICONS.OPEN);
    expect(getStatusIcon('open')).toBe('○');
  });

  it('returns half-filled circle for in_progress', () => {
    expect(getStatusIcon('in_progress')).toBe(ICONS.IN_PROGRESS);
    expect(getStatusIcon('in_progress')).toBe('◐');
  });

  it('returns filled circle for blocked', () => {
    expect(getStatusIcon('blocked')).toBe(ICONS.BLOCKED);
    expect(getStatusIcon('blocked')).toBe('●');
  });

  it('returns empty circle for deferred', () => {
    expect(getStatusIcon('deferred')).toBe(ICONS.DEFERRED);
    expect(getStatusIcon('deferred')).toBe('○');
  });

  it('returns checkmark for closed', () => {
    expect(getStatusIcon('closed')).toBe(ICONS.CLOSED);
    expect(getStatusIcon('closed')).toBe('✓');
  });

  it('returns empty string for unknown status', () => {
    expect(getStatusIcon('unknown' as 'open')).toBe('');
  });
});

describe('formatStatus', () => {
  it('formats open with icon and space', () => {
    expect(formatStatus('open')).toBe('○ open');
  });

  it('formats in_progress with icon and space', () => {
    expect(formatStatus('in_progress')).toBe('◐ in_progress');
  });

  it('formats blocked with icon and space', () => {
    expect(formatStatus('blocked')).toBe('● blocked');
  });

  it('formats deferred with icon and space', () => {
    expect(formatStatus('deferred')).toBe('○ deferred');
  });

  it('formats closed with icon and space', () => {
    expect(formatStatus('closed')).toBe('✓ closed');
  });
});

describe('getStatusColor', () => {
  const colors = createColors('always');

  it('returns info color (blue) for open', () => {
    const colorFn = getStatusColor('open', colors);
    expect(colorFn('test')).toBe(colors.info('test'));
  });

  it('returns success color (green) for in_progress', () => {
    const colorFn = getStatusColor('in_progress', colors);
    expect(colorFn('test')).toBe(colors.success('test'));
  });

  it('returns error color (red) for blocked', () => {
    const colorFn = getStatusColor('blocked', colors);
    expect(colorFn('test')).toBe(colors.error('test'));
  });

  it('returns dim color for deferred', () => {
    const colorFn = getStatusColor('deferred', colors);
    expect(colorFn('test')).toBe(colors.dim('test'));
  });

  it('returns dim color for closed', () => {
    const colorFn = getStatusColor('closed', colors);
    expect(colorFn('test')).toBe(colors.dim('test'));
  });

  it('returns identity function for unknown status', () => {
    const colorFn = getStatusColor('unknown' as 'open', colors);
    expect(colorFn('test')).toBe('test');
  });
});
