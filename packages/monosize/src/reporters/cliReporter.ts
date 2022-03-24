import * as chalk from 'chalk';
import * as Table from 'cli-table3';

import { ComparedReport } from '../utils/compareResultsInReports';
import { DiffByMetric } from '../utils/calculateDiffByMetric';
import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport';
import { formatBytes } from '../utils/helpers';

function getDirectionSymbol(value: number): string {
  if (value < 0) {
    return '↓';
  }

  if (value > 0) {
    return '↑';
  }

  return '';
}

function formatDelta(diff: DiffByMetric): string {
  if (diff.delta === 0) {
    return '';
  }

  const colorFn = diff.delta > 0 ? chalk.red : chalk.green;

  return colorFn(diff.percent + getDirectionSymbol(diff.delta));
}

export async function cliReporter(report: ComparedReport): Promise<void> {
  const result = new Table({
    colAligns: ['left', 'right', 'right'],
    head: ['Fixture', 'Before', 'After (minified/GZIP)'],
  });
  const { changedEntries } = getChangedEntriesInReport(report);

  changedEntries.forEach(entry => {
    const { diff, gzippedSize, minifiedSize, name, packageName } = entry;
    const fixtureColumn = chalk.bold(packageName) + '\n' + name + (diff.empty ? chalk.cyan(' (new)') : '');

    const minifiedBefore = diff.empty ? 'N/A' : formatBytes(minifiedSize - diff.minified.delta);
    const gzippedBefore = diff.empty ? 'N/A' : formatBytes(gzippedSize - diff.gzip.delta);

    const minifiedAfter = formatBytes(minifiedSize);
    const gzippedAfter = formatBytes(gzippedSize);

    const beforeColumn = minifiedBefore + '\n' + gzippedBefore;
    const afterColumn =
      formatDelta(diff.minified) + ' ' + minifiedAfter + '\n' + formatDelta(diff.gzip) + ' ' + gzippedAfter;

    result.push([fixtureColumn, beforeColumn, afterColumn]);
  });

  if (result.length > 0) {
    console.log(result.toString());
    return;
  }

  console.log(`${chalk.green('[✔]')} No changes found`);
}
