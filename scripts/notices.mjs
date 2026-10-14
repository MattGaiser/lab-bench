import { readFile, writeFile } from 'node:fs/promises';
const packages = [
  'react',
  'react-dom',
  'scheduler',
  'lucide-react',
  '@fontsource-variable/manrope',
];
let output =
  'Lab Bench — third-party notices\n\nThe production build includes the following packages and font assets.\n\n';
for (const name of packages) {
  const root = new URL(`../node_modules/${name}/`, import.meta.url);
  const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const license = await readFile(new URL('LICENSE', root), 'utf8');
  output += `${'='.repeat(72)}\n${name} ${metadata.version}\n${'='.repeat(72)}\n\n${license.trim()}\n\n`;
}
await writeFile(new URL('../THIRD_PARTY_NOTICES.txt', import.meta.url), output);
