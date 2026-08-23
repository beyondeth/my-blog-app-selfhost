#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const tracked = spawnSync('git', ['ls-files', '-z'], {
  encoding: 'buffer',
  maxBuffer: 16 * 1024 * 1024,
});

if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr);
  process.exit(tracked.status ?? 1);
}

const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
  ['Aigory API key', /blog_sk_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{20,}/g],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/g],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/g],
  ['OpenAI API key', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['Stripe live secret', /sk_live_[A-Za-z0-9]{20,}/g],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
];

const findings = [];
const files = tracked.stdout
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

for (const file of files) {
  let buffer;
  try {
    buffer = readFileSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    findings.push(`${file}: could not read tracked file (${error.message})`);
    continue;
  }

  if (buffer.includes(0)) continue;

  const lines = buffer.toString('utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [label, pattern] of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: possible ${label}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Potential secrets found in tracked files:');
  for (const finding of findings) console.error(`- ${finding}`);
  console.error('Remove and rotate real credentials before publishing.');
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} tracked files.`);
