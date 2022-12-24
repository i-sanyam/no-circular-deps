import childProcess from 'node:child_process';
import { createRequire } from 'module';
import lodash from 'lodash';
import madge from 'madge';
import util from 'node:util';
import { writeFile } from 'node:fs/promises';

const { isEqual } = lodash;
const exec = util.promisify(childProcess.exec);

const require = createRequire(import.meta.url);
const masterCircularDeps = require('./masterCircularDeps.json');

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
    const fileToWrite = `./validate-circular-deps/${fileNameToUse}CircularDeps.log`;
    await writeFile(fileToWrite, JSON.stringify(circularDependencies));
  } catch (e) {
    console.error('Unable to write circular dependencies file', e);
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

  if (branchCircularDeps.length === masterCircularDeps.length
    && isEqual(masterCircularDeps, branchCircularDeps)) {
    return;
  }

  if (branchCircularDeps.length > masterCircularDeps.length) {
    console.error(`Fail. Expected ${masterCircularDeps.length} Circular Dependencies. Got ${branchCircularDeps.length}`);
  }

  const isCircularDependencyCountReduced = branchCircularDeps.length < masterCircularDeps.length;
  let isNewCircularDependencyFound = false;

  for (const newDependency of branchCircularDeps) {
    const existingDependency = masterCircularDeps.find(d => isEqual(d, newDependency));
    if (!existingDependency) {
      isNewCircularDependencyFound = true;
      console.error('new circular dependency', newDependency);
    }
  }

  if (isCircularDependencyCountReduced && !isNewCircularDependencyFound) {
    console.log(`Good Job. You reduced Circular Dependencies from ${masterCircularDeps.length} to ${branchCircularDeps.length}`);
    return;
  }

  throw new Error('Uh Oh! New circular dependency detected.');
};

detectNewCircularDependencies().catch((e) => {
  console.error(e && e.message);
  process.exit(1);
});
