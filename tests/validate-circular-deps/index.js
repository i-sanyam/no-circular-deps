import childProcess from 'child_process';
import { createRequire } from 'module';
import lodash from 'lodash';
import madge from 'madge';
import util from 'util';
import { promises as fsPromises } from 'fs';

const { isEqual } = lodash;
const { writeFile } = fsPromises;

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
    console.error('\x1b[33m');
    console.error('Unable to write circular dependencies file\n', '\x1b[0m', e);
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
      console.error('\x1b[31m', 'error', '\x1b[0m', newDependency.toString(), '\x1b[90m', 'new-circular-dependency');
    }
  }

  if (isCircularDependencyCountReduced && newCircularDependencyCount === 0) {
    console.log('\x1b[32m');
    console.log('Good Job!', '\x1b[0m', `You reduced Circular Dependencies from ${baseCircularDeps.length} to ${branchCircularDeps.length}.`);
    console.log('\x1b[33m', '\x1b[1m');
    console.log(`Please update circular dependencies in ${BASE_CIRCULAR_DEPS_FILENAME}`, '\x1b[0m');
    return;
  }

  if (branchCircularDeps.length > baseCircularDeps.length) {
    throw new Error(`Expected ${baseCircularDeps.length} Circular Dependencies. Got ${branchCircularDeps.length}`);
  }
  throw new Error(`${newCircularDependencyCount} New circular dependencies detected.`);
};

detectNewCircularDependencies().catch((e) => {
  console.error('\x1b[1m', '\x1b[31m', '\n');
  console.error(e && e.message);
  console.error('✖ Failed!', '\x1b[0m');
  process.exitCode = 2;
});
