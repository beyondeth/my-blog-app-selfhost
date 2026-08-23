#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDirectories = process.argv.slice(2);

if (packageDirectories.length === 0) {
  console.error('Usage: node scripts/quality-dependency-audit.mjs <package-dir> [...]');
  process.exit(2);
}

const severities = ['info', 'low', 'moderate', 'high', 'critical'];

function parseAuditReport(output) {
  const trimmed = output.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstObject = trimmed.indexOf('{');
    const lastObject = trimmed.lastIndexOf('}');
    if (firstObject === -1 || lastObject <= firstObject) return null;

    try {
      return JSON.parse(trimmed.slice(firstObject, lastObject + 1));
    } catch {
      return null;
    }
  }
}

function advisoryEntries(report) {
  const advisories = report?.advisories ?? report?.vulnerabilities ?? {};
  if (Array.isArray(advisories)) return advisories;

  return Object.entries(advisories).map(([name, advisory]) => ({
    ...(advisory ?? {}),
    name: advisory?.module_name ?? name,
  }));
}

function severityCounts(report, advisories) {
  const declared = report?.metadata?.vulnerabilities;
  const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));

  if (declared && typeof declared === 'object') {
    for (const severity of severities) {
      counts[severity] = Number(declared[severity] ?? 0);
    }
    return counts;
  }

  for (const advisory of advisories) {
    const severity = String(advisory.severity ?? '').toLowerCase();
    if (severity in counts) counts[severity] += 1;
  }

  return counts;
}

function advisoryDescription(advisory) {
  const via = Array.isArray(advisory.via) ? advisory.via : [];
  const viaObject = via.find((item) => item && typeof item === 'object');
  return advisory.title ?? viaObject?.title ?? advisory.name ?? 'Unnamed advisory';
}

function advisoryUrl(advisory) {
  const via = Array.isArray(advisory.via) ? advisory.via : [];
  const viaObject = via.find((item) => item && typeof item === 'object');
  return advisory.url ?? viaObject?.url ?? '';
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const results = [];
let hasUnparseableAudit = false;

for (const packageDirectory of packageDirectories) {
  const manifest = JSON.parse(
    readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'),
  );
  if (Object.keys(manifest.dependencies ?? {}).length === 0) {
    results.push({
      packageDirectory,
      counts: Object.fromEntries(severities.map((severity) => [severity, 0])),
      advisories: [],
    });
    continue;
  }

  const auditArgs = ['--dir', packageDirectory, 'audit', '--prod'];
  auditArgs.push('--json');

  const result = spawnSync(
    'pnpm',
    auditArgs,
    { encoding: 'utf8' },
  );
  const report = parseAuditReport(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);

  if (!report) {
    hasUnparseableAudit = true;
    console.error(`Could not parse pnpm audit output for ${packageDirectory}.`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    continue;
  }

  const advisories = advisoryEntries(report);
  const counts = severityCounts(report, advisories);
  results.push({ packageDirectory, counts, advisories });
}

const totalCritical = results.reduce((sum, result) => sum + result.counts.critical, 0);
const totalVulnerabilities = results.reduce(
  (sum, result) =>
    sum + severities.reduce((count, severity) => count + result.counts[severity], 0),
  0,
);
const highAdvisories = results.flatMap((result) =>
  result.advisories
    .filter((advisory) => String(advisory.severity ?? '').toLowerCase() === 'high')
    .map((advisory) => ({ ...advisory, packageDirectory: result.packageDirectory })),
);

const lines = [
  '## Production dependency audit',
  '',
  '| Package | Critical | High | Moderate | Low | Info |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
];

for (const result of results) {
  lines.push(
    `| ${markdownCell(result.packageDirectory)} | ${result.counts.critical} | ${result.counts.high} | ${result.counts.moderate} | ${result.counts.low} | ${result.counts.info} |`,
  );
}

lines.push('', `**Critical gate:** ${totalCritical === 0 ? 'PASS (0)' : `FAIL (${totalCritical})`}`);
lines.push(`**Zero-vulnerability gate:** ${totalVulnerabilities === 0 ? 'PASS (0)' : `FAIL (${totalVulnerabilities})`}`);

if (highAdvisories.length > 0) {
  lines.push('', '### High-severity triage', '');
  lines.push('These advisories are intentionally recorded for remediation or an explicit dependency exception; they do not pass silently.', '');
  for (const advisory of highAdvisories.slice(0, 50)) {
    const url = advisoryUrl(advisory);
    const title = markdownCell(advisoryDescription(advisory));
    lines.push(`- **${markdownCell(advisory.packageDirectory)} / ${markdownCell(advisory.name)}**: ${title}${url ? ` ([advisory](${url}))` : ''}`);
  }
  if (highAdvisories.length > 50) {
    lines.push(`- ${highAdvisories.length - 50} additional high-severity advisories omitted from the summary; inspect the package audit output for the full list.`);
  }
} else {
  lines.push('', '### High-severity triage', '', 'No high-severity production advisories were reported.');
}

if (hasUnparseableAudit) {
  lines.push('', '> Audit output could not be parsed for at least one package. The job fails until the audit can be reproduced.');
}

const summary = `${lines.join('\n')}\n`;
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (hasUnparseableAudit || totalVulnerabilities > 0) {
  process.exitCode = 1;
}
