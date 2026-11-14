import { spawnSync } from 'node:child_process';

const commands = [
  ['audit:images', ['run', 'audit:images']],
  ['audit:product-photos', ['run', 'audit:product-photos']],
];

for (const [label, args] of commands) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync('npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nRelease catalogue verification passed.');
