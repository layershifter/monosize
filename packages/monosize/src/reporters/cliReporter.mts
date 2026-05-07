import Table from 'cli-table3';
import { styleText } from 'node:util';

import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { AssetDiff, DiffByMetric } from '../utils/calculateDiff.mjs';
import type { ComparedReportEntry } from '../utils/compareResultsInReports.mjs';
import { logger } from '../logger.mjs';
import { formatDeltaFactory, type Reporter } from './shared.mjs';

type Row = [string, string, string];

function getDirectionSymbol(value: number): string {
  if (value < 0) return '↓';
  if (value > 0) return '↑';
  return '';
}

function formatDelta(diff: DiffByMetric, deltaFormat: keyof DiffByMetric): string {
  const output = formatDeltaFactory(diff, { deltaFormat, directionSymbol: getDirectionSymbol });
  const color = diff.delta > 0 ? ('red' as const) : ('green' as const);

  return typeof output === 'string'
    ? output
    : styleText(color, output.deltaOutput + output.dirSymbol);
}

function buildEntryRow(entry: ComparedReportEntry, deltaFormat: keyof DiffByMetric): Row {
  const { diff, gzippedSize, minifiedSize, name, packageName } = entry;

  const fixtureColumn = [
    styleText('bold', packageName),
    name + (diff.empty ? styleText('cyan', ' (new)') : ''),
    diff.exceedsThreshold && styleText('red', `(${styleText('bold', '!')} over threshold)`),
  ]
    .filter(Boolean)
    .join('\n');

  const minifiedBefore = diff.empty ? 'N/A' : formatBytes(minifiedSize - diff.minified.delta);
  const gzippedBefore = diff.empty ? 'N/A' : formatBytes(gzippedSize - diff.gzip.delta);
  const beforeColumn = [minifiedBefore, gzippedBefore].join('\n');

  const minifiedAfter = formatDelta(diff.minified, deltaFormat) + ' ' + formatBytes(minifiedSize);
  const gzippedAfter = formatDelta(diff.gzip, deltaFormat) + ' ' + formatBytes(gzippedSize);
  const afterColumn = [minifiedAfter, gzippedAfter].join('\n');

  return [fixtureColumn, beforeColumn, afterColumn];
}

/**
 * Per-asset-type sub-rows for a single fixture. One row per type whose
 * minified or gzip delta is non-zero, sorted lexicographically. Iterates
 * `Object.keys` so future-version JSON carrying unknown types (e.g. a
 * stored `assets.svg`) still surfaces. Returns `[]` when only a single
 * type changed — that sub-row would just duplicate the top-level total.
 */
function buildBreakdownRows(
  assetsDiff: Record<string, AssetDiff> | undefined,
  deltaFormat: keyof DiffByMetric,
): Row[] {
  if (!assetsDiff) return [];

  const changedTypes = Object.keys(assetsDiff)
    .filter(t => assetsDiff[t].minified.delta !== 0 || assetsDiff[t].gzip.delta !== 0)
    .sort();

  if (changedTypes.length <= 1) return [];

  return changedTypes.map(type => {
    const d = assetsDiff[type];
    return [
      styleText('dim', `  ${type}`),
      '',
      [formatDelta(d.minified, deltaFormat), formatDelta(d.gzip, deltaFormat)].join('\n'),
    ];
  });
}

export const cliReporter: Reporter = (report, options) => {
  const { commitSHA, repository, deltaFormat } = options;
  const { changedEntries } = getChangedEntriesInReport(report);

  if (changedEntries.length === 0) {
    logger.success('No changes found');
    return;
  }

  const table = new Table({
    colAligns: ['left', 'right', 'right'],
    head: ['Fixture', 'Before', 'After (minified/GZIP)'],
  });

  for (const entry of changedEntries) {
    table.push(buildEntryRow(entry, deltaFormat));
    for (const row of buildBreakdownRows(entry.assetsDiff, deltaFormat)) {
      table.push(row);
    }
  }

  const footer = `🤖 This report was generated against '${repository}/commit/${commitSHA}'`;
  logger.raw(table.toString());
  logger.raw('');
  logger.raw(footer);
};
