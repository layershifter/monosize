import { findUp } from 'find-up';
import { pathToFileURL } from 'node:url';
import pc from 'picocolors';

import type { MonoSizeConfig } from '../types.mjs';

const CONFIG_FILE_NAME = ['monosize.config.js', 'monosize.config.mjs'];
const defaultConfig: Partial<MonoSizeConfig> = {
  webpack: config => config,
};

let cache: MonoSizeConfig | undefined;

export function resetConfigCache() {
  cache = undefined;
}

export async function readConfig(quiet = true): Promise<MonoSizeConfig> {
  // don't use the cache in tests
  if (cache && process.env.NODE_ENV !== 'test') {
    return cache;
  }

  const configPath = await findUp(CONFIG_FILE_NAME, { cwd: process.cwd() });

  if (!configPath) {
    console.log([pc.red('[e]'), `No config file found in ${configPath}`].join(' '));
    process.exit(1);
  }

  if (!quiet) {
    console.log([pc.blue('[i]'), `Using following config ${configPath}`].join(' '));
  }

  const configFile = await import(pathToFileURL(configPath).toString());
  // TODO: config validation via schema
  const userConfig = configFile.default;

  cache = {
    ...defaultConfig,
    ...userConfig,
  } as MonoSizeConfig;

  return cache;
}
