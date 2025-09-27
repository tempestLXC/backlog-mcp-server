#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const summaryPath = path.resolve('coverage', 'coverage-summary.json');
const badgePath = path.resolve('.github', 'badges', 'coverage.json');

const COLORS = [
  { threshold: 90, color: 'brightgreen' },
  { threshold: 80, color: 'green' },
  { threshold: 70, color: 'yellowgreen' },
  { threshold: 60, color: 'yellow' },
  { threshold: 50, color: 'orange' },
];

async function readCoveragePercentage() {
  try {
    const raw = await fs.readFile(summaryPath, 'utf8');
    const summary = JSON.parse(raw);
    const pct = summary?.total?.lines?.pct;
    if (typeof pct !== 'number' || Number.isNaN(pct)) {
      throw new Error('Coverage summary does not contain a numeric total.lines.pct value.');
    }
    return pct;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Coverage summary file not found at ${summaryPath}. Did you run Jest with --coverage?`);
    }
    throw error;
  }
}

function determineColor(percentage) {
  for (const { threshold, color } of COLORS) {
    if (percentage >= threshold) {
      return color;
    }
  }
  return 'red';
}

function formatPercentage(percentage) {
  if (percentage >= 99.95) {
    return '100%';
  }
  return `${percentage.toFixed(1)}%`;
}

async function writeBadge(percentage) {
  await fs.mkdir(path.dirname(badgePath), { recursive: true });
  const badge = {
    schemaVersion: 1,
    label: 'coverage',
    message: formatPercentage(percentage),
    color: determineColor(percentage),
  };
  await fs.writeFile(badgePath, `${JSON.stringify(badge, null, 2)}\n`, 'utf8');
}

async function main() {
  const percentage = await readCoveragePercentage();
  await writeBadge(percentage);
  console.log(`Updated coverage badge to ${percentage.toFixed(2)}%.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
