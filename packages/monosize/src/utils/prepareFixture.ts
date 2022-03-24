import Ajv from 'ajv';
import { transformAsync } from '@babel/core';
import * as fs from 'fs';
import * as path from 'path';
import { BabelFileResult } from '@babel/core';

import { fixtureSchema } from '../schemas';

type FixtureMetadata = {
  name: string;
};

export type PreparedFixture = {
  absolutePath: string;
  relativePath: string;
  name: string;
};

const ajv = new Ajv();

/**
 * Prepares a fixture file to be compiled with Webpack, grabs data from a default export and removes it.
 */
export async function prepareFixture(fixture: string): Promise<PreparedFixture> {
  const sourceFixturePath = path.resolve(process.cwd(), fixture);
  const sourceFixtureCode = await fs.promises.readFile(sourceFixturePath, 'utf8');

  const result = await transformAsync(sourceFixtureCode, {
    ast: false,
    code: true,

    // This instance of Babel should ignore all user's configs and apply only our plugin
    configFile: false, // https://babeljs.io/docs/en/options#configfile
    babelrc: false, // https://babeljs.io/docs/en/options#babelrc

    plugins: [
      // A Babel plugin that:
      // - reads metadata (name, threshold, etc.)
      // - removes a default export with metadata
      {
        visitor: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          ExportDefaultDeclaration(exportPath, state) {
            const evaluationResult = exportPath.get('declaration').evaluate();

            if (!evaluationResult.confident) {
              // TODO: proper error reporting
              throw new Error();
            }

            const valid = ajv.validate(fixtureSchema, evaluationResult.value);

            if (!valid) {
              throw new Error(`Validation failed for a schema in a component: ${ajv.errorsText(ajv.errors)}`);
            }

            state.file.metadata = evaluationResult.value;
            exportPath.remove();
          },
        },
      },
    ],
  });

  function isTransformedFixtureResultHasMetadata(
    value: BabelFileResult | null,
  ): value is BabelFileResult & { metadata: FixtureMetadata } {
    return Boolean(value && value.metadata && Object.keys(value.metadata).length);
  }

  if (!isTransformedFixtureResultHasMetadata(result)) {
    throw new Error(
      [
        'A fixture file should contain a default export with metadata.',
        "For example: export default { name: 'Test fixture' }",
      ].join('\n'),
    );
  }

  const outputFixturePath = path.resolve(process.cwd(), 'dist', fixture);

  await fs.promises.mkdir(path.dirname(outputFixturePath), { recursive: true });
  await fs.promises.writeFile(outputFixturePath, result.code!);

  return {
    absolutePath: outputFixturePath,
    relativePath: fixture,

    name: result.metadata.name,
  };
}
