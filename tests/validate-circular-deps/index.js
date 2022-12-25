import childProcess from 'node:child_process';
import { createRequire } from 'module';
import lodash from 'lodash';
import madge from 'madge';
import util from 'node:util';
import { writeFile } from 'node:fs/promises';
import { logInfo, logError, CLI_COLOR } from './log.js';

const { isEqual } = lodash;
const exec = util.promisify(childProcess.exec);

const require = createRequire(import.meta.url);
const baseCircularDeps = require('./masterCircularDeps.json');

const BASE_BRANCH = 'master';
const BASE_CIRCULAR_DEPS_FILENAME = `${BASE_BRANCH}CircularDeps.json`;

const getCurrentGitBranchName = async () => {
  try {
    const { stdout } = await exec('git rev-parse --abbrev-ref HEAD');
    if (typeof stdout === 'string') {
      const gitBranchName = stdout.trim();
      return gitBranchName.replace(/\\|\//g, '-');
    }
    throw new Error('Unable to get branch name');
  } catch (e) {
    // warn error here
    return 'yourBranch';
  }
};

const generateCircularDependenciesLogFile = async (circularDependencies, fileName) => {
  try {
    const fileNameToUse = !fileName ? await getCurrentGitBranchName() : fileName;
    const fileToWrite = `./tests/validate-circular-deps/${fileNameToUse}CircularDeps.log`;
    await writeFile(fileToWrite, JSON.stringify(circularDependencies));
  } catch (e) {
    logError(CLI_COLOR.FgYellow, 'Unable to write circular dependencies file');
    logError(e && e.message);
  }
};

const getCircularDependencies = async (path = './', options = {}) => {
  const { log: createLogFile = false, fileName } = options;
  const result = await madge(path);
  const circularDependencies = result.circular();
  if (createLogFile) {
    await generateCircularDependenciesLogFile(circularDependencies, fileName);
  }
  return circularDependencies;
};

const detectNewCircularDependencies = async () => {
  const branchCircularDeps = await getCircularDependencies('./', { log: true });

  if (branchCircularDeps.length === baseCircularDeps.length
    && isEqual(baseCircularDeps, branchCircularDeps)) {
    return;
  }

  const isCircularDependencyCountReduced = branchCircularDeps.length < baseCircularDeps.length;
  let newCircularDependencyCount = 0;

  for (const newDependency of branchCircularDeps) {
    const existingDependency = baseCircularDeps.find((d) => isEqual(d, newDependency));
    if (!existingDependency) {
      newCircularDependencyCount += 1;
      logError(CLI_COLOR.FgRed, 'error', CLI_COLOR.Reset, newDependency.toString(), CLI_COLOR.FgGray, 'new-circular-dependency');
    }
  }

  if (isCircularDependencyCountReduced && newCircularDependencyCount === 0) {
    logInfo(CLI_COLOR.FgGreen, '\nGood Job!');
    logInfo(`  You reduced Circular Dependencies from ${baseCircularDeps.length} to ${branchCircularDeps.length}.`);
    logInfo(CLI_COLOR.Bright, CLI_COLOR.FgYellow, `Please update circular dependencies in ${BASE_CIRCULAR_DEPS_FILENAME}`);
    return;
  }

  if (branchCircularDeps.length > baseCircularDeps.length) {
    throw new Error(`Expected ${baseCircularDeps.length} Circular Dependencies. Got ${branchCircularDeps.length}`);
  }
  throw new Error(`${newCircularDependencyCount} New circular dependencies detected.`);
};

detectNewCircularDependencies().catch((e) => {
  logError(e && e.message);
  logError(CLI_COLOR.Bright, CLI_COLOR.FgRed, '✖ Failed!');
  process.exitCode = 2;
});
