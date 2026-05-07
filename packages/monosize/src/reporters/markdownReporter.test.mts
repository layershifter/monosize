import prettier from 'prettier';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { reportWithExceededThreshold, sampleComparedReport } from '../__fixtures__/sampleComparedReport.mjs';
import { logger } from '../logger.mjs';
import { markdownReporter } from './markdownReporter.mjs';
import type { ComparedReport } from '../utils/compareResultsInReports.mjs';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe('markdownReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: true,
    deltaFormat: 'delta' as const,
  };

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('wont render anything if there is nothing to compare', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter([], options);
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchInlineSnapshot(`
      "## 📊 Bundle size report

      ✅ No changes found
      "
    `);
  });

  it('renders a report to a file', async () => {
    const rawLog = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(sampleComparedReport, options);
    const output = await prettier.format(rawLog.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });

  it('renders a report to a file with specified "deltaFormat"', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(sampleComparedReport, { ...options, deltaFormat: 'percent' });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });

  it('omits a Breakdown section when only a single asset type changed', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    const jsOnlyReport: ComparedReport = [
      {
        packageName: 'js-only-pkg',
        name: 'JS-only entry',
        path: 'js-only.fixture.js',
        minifiedSize: 700,
        gzippedSize: 70,
        assets: { js: { minifiedSize: 700, gzippedSize: 70 } },
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

    markdownReporter(jsOnlyReport, { ...options, showUnchanged: false });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    // The single-type breakdown would just duplicate the totals row, so the
    // section is suppressed (matches cliReporter).
    expect(output).not.toContain('### Breakdown');
  });

  it('renders a report with exceeded threshold', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(reportWithExceededThreshold, { ...options, deltaFormat: 'percent' });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });
});
