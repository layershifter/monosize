import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import { hasMovedAssetDelta, type DiffByMetric } from '../utils/calculateDiff.mjs';
import { formatDeltaFactory, type Reporter } from './shared.mjs';
import { logger } from '../logger.mjs';

const icons = { increase: 'increase.png', decrease: 'decrease.png' };

function getDirectionSymbol(value: number): string {
  const img = (iconName: string) =>
    `<img aria-hidden="true" src="https://microsoft.github.io/monosize/images/${iconName}" />`;

  if (value < 0) {
    return img(icons.decrease);
  }

  if (value > 0) {
    return img(icons.increase);
  }

  return '';
}

function formatDelta(diff: DiffByMetric, deltaFormat: keyof DiffByMetric): string {
  const output = formatDeltaFactory(diff, { deltaFormat, directionSymbol: getDirectionSymbol });

  return typeof output === 'string' ? output : `\`${output.deltaOutput}\` ${output.dirSymbol}`;
}

export const markdownReporter: Reporter = (report, options) => {
  const { commitSHA, repository, showUnchanged, deltaFormat } = options;
  const footer = `<sub>🤖 This report was generated against <a href='${repository}/commit/${commitSHA}'>${commitSHA}</a></sub>`;

  const { changedEntries, unchangedEntries } = getChangedEntriesInReport(report);

  const reportOutput = ['## 📊 Bundle size report', ''];

  if (changedEntries.length === 0) {
    reportOutput.push(`✅ No changes found`);
    logger.raw(reportOutput.join('\n'));
    return;
  }

  if (changedEntries.length > 0) {
    reportOutput.push('| Package & Exports | Baseline (minified/GZIP) | PR    | Change     |');
    reportOutput.push('| :---------------- | -----------------------: | ----: | ---------: |');

    changedEntries.forEach(entry => {
      const primary = `<samp>${entry.packageName}</samp>`;
      const secondary = `<abbr title='${entry.path}'>${entry.name}</abbr>`;
      const tertiary = entry.diff.exceedsThreshold ? '⚠️ over threshold' : '';
      const name = `${primary} <br /> ${secondary} ${tertiary ? `<br /> ${tertiary}` : ''}`;

      const before = entry.diff.empty
        ? [`\`${formatBytes(0)}\``, '<br />', `\`${formatBytes(0)}\``].join('')
        : [
            `\`${formatBytes(entry.minifiedSize - entry.diff.minified.delta)}\``,
            '<br />',
            `\`${formatBytes(entry.gzippedSize - entry.diff.gzip.delta)}\``,
          ].join('');
      const after = [`\`${formatBytes(entry.minifiedSize)}\``, '<br />', `\`${formatBytes(entry.gzippedSize)}\``].join(
        '',
      );
      const difference = entry.diff.empty
        ? '🆕 New entry'
        : [
            `${formatDelta(entry.diff.minified, deltaFormat)}`,
            '<br />',
            `${formatDelta(entry.diff.gzip, deltaFormat)}`,
          ].join('');

      reportOutput.push(`| ${name} | ${before} | ${after} | ${difference}|`);
    });

    reportOutput.push('');

    // Per-asset-type breakdown lives in its own section after the totals
    // table — GFM tables can't span sub-rows, so interleaving <details>
    // mid-table would break parsing. One <details> block per changed entry
    // whose breakdown moved across more than one type — a single moved type
    // would just duplicate the totals row, matching the cliReporter rule.
    const entriesWithBreakdown = changedEntries.flatMap(entry => {
      if (!entry.assetsDiff) {
        return [];
      }
      const movedTypes = Object.keys(entry.assetsDiff)
        .filter(t => hasMovedAssetDelta(entry.assetsDiff![t]))
        .sort();
      if (movedTypes.length <= 1) {
        return [];
      }
      return [{ entry, movedTypes }];
    });
    const missingBreakdown = changedEntries.some(entry => !entry.assetsDiff && !entry.diff.empty);

    if (entriesWithBreakdown.length > 0 || missingBreakdown) {
      reportOutput.push('### Breakdown', '');

      if (missingBreakdown) {
        reportOutput.push(
          '> Breakdown unavailable for some fixtures (remote report predates per-asset support — re-run measure on main to populate).',
          '',
        );
      }

      for (const { entry, movedTypes } of entriesWithBreakdown) {
        reportOutput.push(`<details><summary><samp>${entry.packageName}</samp> · ${entry.name}</summary>`, '');
        for (const type of movedTypes) {
          const d = entry.assetsDiff![type];
          reportOutput.push(
            `- \`${type}\`: ${formatDelta(d.minified, deltaFormat)} minified, ${formatDelta(d.gzip, deltaFormat)} gzipped`,
          );
        }
        reportOutput.push('</details>', '');
      }
    }
  }

  if (showUnchanged && unchangedEntries.length > 0) {
    reportOutput.push('<details>');
    reportOutput.push('<summary>Unchanged fixtures</summary>');
    reportOutput.push('');

    reportOutput.push('| Package & Exports | Size (minified/GZIP) |');
    reportOutput.push('| ----------------- | -------------------: |');

    unchangedEntries.forEach(entry => {
      const title = `<samp>${entry.packageName}</samp> <br /> <abbr title='${entry.path}'>${entry.name}</abbr>`;
      const size = [`\`${formatBytes(entry.minifiedSize)}\``, '<br />', `\`${formatBytes(entry.gzippedSize)}\``].join(
        '',
      );

      reportOutput.push(`| ${title} | ${size} |`);
    });

    reportOutput.push('</details>');
  }

  // TODO: use repo settings
  reportOutput.push(footer);

  logger.raw(reportOutput.join('\n'));
};
