import { describe, expect, it } from 'vitest';

import { EMPTY_DIFF } from './calculateDiff.mjs';
import { type ComparedReport } from './compareResultsInReports.mjs';
import { getChangedEntriesInReport, isUnchanged } from './getChangedEntriesInReport.mjs';

const flatTotals = {
  empty: false,
  exceedsThreshold: false,
  minified: { delta: 0, percent: '0%' },
  gzip: { delta: 0, percent: '0%' },
} as const;

const movedTotals = {
  empty: false,
  exceedsThreshold: false,
  minified: { delta: 100, percent: '10%' },
  gzip: { delta: 10, percent: '10%' },
} as const;

const baseEntry: Omit<ComparedReport[number], 'diff'> = {
  packageName: 'pkg',
  name: 'fixture',
  path: 'fixture.js',
  minifiedSize: 1000,
  gzippedSize: 100,
};

describe('isUnchanged', () => {
  it('returns false for an EMPTY_DIFF entry (new entries count as changed)', () => {
    expect(isUnchanged({ ...baseEntry, diff: EMPTY_DIFF })).toBe(false);
  });

  it('returns true when totals are flat and assetsDiff is absent', () => {
    expect(isUnchanged({ ...baseEntry, diff: flatTotals })).toBe(true);
  });

  it('returns true when totals are flat and every breakdown delta is zero', () => {
    expect(
      isUnchanged({
        ...baseEntry,
        diff: flatTotals,
        assetsDiff: {
          js: { minified: { delta: 0, percent: '0%' }, gzip: { delta: 0, percent: '0%' } },
          css: { minified: { delta: 0, percent: '0%' }, gzip: { delta: 0, percent: '0%' } },
        },
      }),
    ).toBe(true);
  });

  it('returns false when totals moved', () => {
    expect(isUnchanged({ ...baseEntry, diff: movedTotals })).toBe(false);
  });

  it('returns false when totals are flat but a breakdown minified delta moved', () => {
    expect(
      isUnchanged({
        ...baseEntry,
        diff: flatTotals,
        assetsDiff: {
          js: { minified: { delta: -500, percent: '-50%' }, gzip: { delta: 0, percent: '0%' } },
          css: { minified: { delta: 500, percent: '100%' }, gzip: { delta: 0, percent: '0%' } },
        },
      }),
    ).toBe(false);
  });

  it('returns false when totals are flat but a breakdown gzip delta moved', () => {
    expect(
      isUnchanged({
        ...baseEntry,
        diff: flatTotals,
        assetsDiff: {
          js: { minified: { delta: 0, percent: '0%' }, gzip: { delta: -50, percent: '-50%' } },
          css: { minified: { delta: 0, percent: '0%' }, gzip: { delta: 50, percent: '100%' } },
        },
      }),
    ).toBe(false);
  });
});

describe('getChangedEntriesInReport', () => {
  it('splits entries to changed an unchanged', () => {
    const report: ComparedReport = [
      { packageName: 'abc', name: 'abc-a', path: 'abc-a.js', minifiedSize: 0, gzippedSize: 0, diff: EMPTY_DIFF },
      {
        packageName: 'abc',
        name: 'abc-b',
        path: 'abc-b.js',
        minifiedSize: 0,
        gzippedSize: 0,
        diff: {
          empty: false,
          exceedsThreshold: false,

          minified: { delta: 0, percent: '0%' },
          gzip: { delta: 0, percent: '0%' },
        },
      },
      { packageName: 'xyz', name: 'xyz', path: 'xyz.js', minifiedSize: 0, gzippedSize: 0, diff: EMPTY_DIFF },
    ];
    const actual = getChangedEntriesInReport(report);

    expect(actual.changedEntries).toHaveLength(2);
    expect(actual.changedEntries[0]).toEqual(report[0]);
    expect(actual.changedEntries[1]).toEqual(report[2]);

    expect(actual.unchangedEntries).toHaveLength(1);
    expect(actual.unchangedEntries[0]).toEqual(report[1]);
  });

  it('classifies a totals-flat entry as changed when its breakdown moved', () => {
    const breakdownOnlyChange: ComparedReport[number] = {
      packageName: 'pkg',
      name: 'rebalanced',
      path: 'rebalanced.fixture.js',
      minifiedSize: 1000,
      gzippedSize: 100,
      diff: {
        empty: false,
        exceedsThreshold: false,
        minified: { delta: 0, percent: '0%' },
        gzip: { delta: 0, percent: '0%' },
      },
      assetsDiff: {
        js: { minified: { delta: -500, percent: '-50%' }, gzip: { delta: -50, percent: '-50%' } },
        css: { minified: { delta: 500, percent: '100%' }, gzip: { delta: 50, percent: '100%' } },
      },
    };
    const totallyFlat: ComparedReport[number] = {
      packageName: 'pkg',
      name: 'flat',
      path: 'flat.fixture.js',
      minifiedSize: 1000,
      gzippedSize: 100,
      diff: {
        empty: false,
        exceedsThreshold: false,
        minified: { delta: 0, percent: '0%' },
        gzip: { delta: 0, percent: '0%' },
      },
      assetsDiff: {
        js: { minified: { delta: 0, percent: '0%' }, gzip: { delta: 0, percent: '0%' } },
      },
    };

    const actual = getChangedEntriesInReport([breakdownOnlyChange, totallyFlat]);

    expect(actual.changedEntries).toHaveLength(1);
    expect(actual.changedEntries[0]).toEqual(breakdownOnlyChange);
    expect(actual.unchangedEntries).toHaveLength(1);
    expect(actual.unchangedEntries[0]).toEqual(totallyFlat);
  });
});
