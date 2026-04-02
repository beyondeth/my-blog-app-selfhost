const { spawn } = require('node:child_process');
const readline = require('node:readline');

const nextBin = require.resolve('next/dist/bin/next');
const warningNeedle = '[baseline-browser-mapping] The data in this module is over two months old.';

const child = spawn(process.execPath, [nextBin, 'build', '--webpack'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA: 'true',
    BROWSERSLIST_IGNORE_OLD_DATA: 'true',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

function pipeWithoutBaselineWarning(stream, target) {
  const rl = readline.createInterface({ input: stream });

  rl.on('line', (line) => {
    if (line.includes(warningNeedle)) {
      return;
    }

    target.write(`${line}\n`);
  });
}

pipeWithoutBaselineWarning(child.stdout, process.stdout);
pipeWithoutBaselineWarning(child.stderr, process.stderr);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
