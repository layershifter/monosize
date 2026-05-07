import stripAnsi from 'strip-ansi';
import { beforeEach, describe, it, expect, vitest } from 'vitest';

import { cliReporter } from './cliReporter.mjs';
import { sampleComparedReport, reportWithExceededThreshold } from '../__fixtures__/sampleComparedReport.mjs';
import { logger } from '../logger.mjs';
import type { ComparedReport } from '../utils/compareResultsInReports.mjs';

function noop() {
  /* does nothing */
}

// We are using "chalk" and "cli-table3" in this reporter, they are adding colors to the output via escape codes that
// makes snapshots look ugly.
//
// It could be disabled for "chalk" but "colors" that is used "cli-table3" is not our dependency.
expect.addSnapshotSerializer({
  test(val) {
    return typeof val === 'string';
  },
  print(val) {
    return stripAnsi(val as string);
  },
});

describe('cliReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: false,
    deltaFormat: 'percent' as const,
  };

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('wont render anything if there is nothing to compare', () => {
    const logSpy = vitest.spyOn(logger, 'success').mockImplementation(noop);

    cliReporter([], options);

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot('No changes found');
  });

  it('renders a report to CLI output', () => {
    const logSpy = vitest.spyOn(console, 'log').mockImplementation(noop);

    cliReporter(sampleComparedReport, options);

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            100%↑ 1 kB │
      │ An entry with diff │    0 B │           100%↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │        │                 100%↑ │
      │                    │        │                 100%↑ │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │        │                 100%↑ │
      │                    │        │                 100%↑ │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │            100%↑ 1 kB │
      │ New entry (new)    │    N/A │           100%↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });

  it('renders a report to CLI output with specified "deltaFormat"', () => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    cliReporter(sampleComparedReport, { ...options, deltaFormat: 'delta' });

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │        │                300 B↑ │
      │                    │        │                 30 B↑ │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │        │                700 B↑ │
      │                    │        │                 70 B↑ │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │             1 B↑ 1 kB │
      │ New entry (new)    │    N/A │            1 B↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });

  it('suppresses per-asset breakdown when only a single type changed', () => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    const jsOnlyReport: ComparedReport = [
      {
        packageName: 'js-only-pkg',
        name: 'JS-only entry',
        path: 'js-only.fixture.js',
        minifiedSize: 700,
        gzippedSize: 70,
        assets: {
          js: { minifiedSize: 700, gzippedSize: 70 },
        },
        diff: {
          empty: false,
          exceedsThreshold: false,
          minified: { delta: 700, percent: '100%' },
          gzip: { delta: 70, percent: '100%' },
        },
        assetsDiff: {
          js: { minified: { delta: 700, percent: '100%' }, gzip: { delta: 70, percent: '100%' } },
        },
      },
    ];

    cliReporter(jsOnlyReport, options);

    // No `  js` sub-row — it would just duplicate the top-level total.
    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌───────────────┬────────┬───────────────────────┐
      │ Fixture       │ Before │ After (minified/GZIP) │
      ├───────────────┼────────┼───────────────────────┤
      │ js-only-pkg   │    0 B │           100%↑ 700 B │
      │ JS-only entry │    0 B │            100%↑ 70 B │
      └───────────────┴────────┴───────────────────────┘
    `);
  });

  it('renders a report with exceeded threshold', () => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    cliReporter(reportWithExceededThreshold, { ...options, deltaFormat: 'delta' });

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      │ (! over threshold) │        │                       │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │        │                300 B↑ │
      │                    │        │                 30 B↑ │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │        │                700 B↑ │
      │                    │        │                 70 B↑ │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });
});
