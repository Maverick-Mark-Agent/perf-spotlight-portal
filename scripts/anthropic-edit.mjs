#!/usr/bin/env node
// Minimal file editor using Anthropic Messages API.
// Usage:
//   ANTHROPIC_API_KEY=sk-... node scripts/anthropic-edit.mjs <path/to/file> "Your edit instructions"
// Optional flags:
//   --model=<modelName> (default: claude-3-5-sonnet-20240620)
//   --max-tokens=<n> (default: 2000)
//   --dry-run (prints result to stdout, does not write file)

import fs from 'fs/promises';
import path from 'path';
import process from 'process';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY in environment');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: ANTHROPIC_API_KEY=... node scripts/anthropic-edit.mjs <file> "<instructions>" [--model=...] [--max-tokens=...] [--dry-run]');
    process.exit(1);
  }

  const targetFile = path.resolve(args[0]);
  const instructions = args[1];

  const modelArg = args.find(a => a.startsWith('--model='));
  const maxTokensArg = args.find(a => a.startsWith('--max-tokens='));
  const dryRun = args.includes('--dry-run');

  const model = modelArg ? modelArg.split('=')[1] : 'claude-3-5-sonnet-20240620';
  const maxTokens = maxTokensArg ? parseInt(maxTokensArg.split('=')[1]) : 2000;

  const original = await fs.readFile(targetFile, 'utf8');

  // Build system and user prompts
  const system = [
    'You are a precise coding assistant. Edit the provided file content according to the instructions.',
    'Return ONLY the full, final file content. Do not include fences or explanations.',
  ].join('\n');

  const userContent = [
    `File path: ${targetFile}`,
    'Edit instructions:',
    instructions,
    '---',
    'Current file content below:',
    original,
  ].join('\n');

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature: 0,
    system,
    messages: [
      { role: 'user', content: userContent },
    ],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Anthropic API error: ${res.status} - ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const parts = data?.content || [];
  const outputText = parts.map((p) => (typeof p === 'string' ? p : p.text || '')).join('');

  if (!outputText || outputText.trim().length === 0) {
    console.error('Empty response from model. Aborting.');
    process.exit(1);
  }

  if (dryRun) {
    process.stdout.write(outputText);
    return;
  }

  // backup original
  const backupPath = `${targetFile}.bak`;
  await fs.writeFile(backupPath, original, 'utf8');

  // write new content
  await fs.writeFile(targetFile, outputText, 'utf8');
  console.log(`Edited ${targetFile}. Backup saved at ${backupPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


