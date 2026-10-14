import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const requireClean = () => {
  if (git('status', '--porcelain').toString().trim())
    throw new Error(
      'Commit the source before packaging so the release identifies an exact revision.',
    );
};
requireClean();
if (!process.env.npm_execpath) throw new Error('Run this script with npm run package.');
execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
  cwd: root,
  stdio: 'inherit',
});
requireClean();
const commit = git('rev-parse', 'HEAD').toString().trim();
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const files = git('ls-tree', '-rz', '--name-only', 'HEAD').toString().split('\0').filter(Boolean);
const archive = {};
// Read source from the commit, not an incidental local download or generated report.
for (const path of files)
  archive[`lab-bench/${path}`] = new Uint8Array(git('show', `${commit}:${path}`));
async function addBuild(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const name = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) await addBuild(path, name);
    else if (entry.isFile()) archive[name] = new Uint8Array(await readFile(path));
    else throw new Error(`Unexpected build artifact: ${path}`);
  }
}
await addBuild(join(root, 'dist'), 'lab-bench/dist');
archive['lab-bench/release.json'] = strToU8(
  JSON.stringify(
    { name: metadata.name, version: metadata.version, sourceCommit: commit },
    null,
    2,
  ) + '\n',
);
await mkdir(join(root, 'artifacts'), { recursive: true });
const output = join(root, 'artifacts', `lab-bench-${metadata.version}.zip`);
await writeFile(output, zipSync(archive, { level: 9 }));
console.log(`Packaged ${Object.keys(archive).length} files from ${commit}\n${output}`);
