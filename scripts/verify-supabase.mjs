#!/usr/bin/env node
// Verifies the Supabase connection + schema for Find My Seat.
// Usage: npm run verify:supabase
// Reads .env (project root) or process.env. Never prints full keys.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const env = { ...process.env };
  const p = path.join(root, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (!env[k]) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const url = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const anon = env.VITE_SUPABASE_ANON_KEY || '';

console.log('Find My Seat — Supabase check\n');

if (!url || !anon) {
  console.log('Missing credentials.\n');
  console.log('  1. cp .env.example .env');
  console.log('  2. Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.log('     (Supabase Dashboard → Project Settings → API)');
  console.log('  3. Re-run: npm run verify:supabase\n');
  process.exit(1);
}

console.log(`URL: ${url}`);
console.log(`Key: ${anon.slice(0, 10)}...${anon.slice(-4)}\n`);

let failures = 0;

async function check(name, fn) {
  try {
    const msg = await fn();
    console.log(`PASS  ${name}${msg ? ` — ${msg}` : ''}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name} — ${e.message}`);
  }
}

const headers = { apikey: anon, Authorization: `Bearer ${anon}` };

await check('REST API reachable', async () => {
  const r = await fetch(`${url}/rest/v1/`, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} — is the project URL correct?`);
  return 'connected';
});

const TABLES = [
  'theatres',
  'screens',
  'seats',
  'navigation_points',
  'navigation_edges',
  'tickets',
  'navigation_sessions',
  'users',
];

for (const t of TABLES) {
  await check(`table: ${t}`, async () => {
    const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, { headers });
    if (r.status === 404) throw new Error('missing — run database/migrations in the SQL Editor');
    if (r.status === 401 || r.status === 403) return 'exists (RLS protected)';
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return 'exists';
  });
}

await check('storage bucket: tickets', async () => {
  const r = await fetch(`${url}/storage/v1/object/list/tickets`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1 }),
  });
  const body = await r.text().catch(() => '');
  if (/bucket not found/i.test(body)) {
    throw new Error('missing — run migration 001 (it creates the bucket)');
  }
  return 'exists';
});

await check('seed data: sample theatre', async () => {
  const r = await fetch(`${url}/rest/v1/theatres?select=name&limit=5`, { headers });
  if (!r.ok) throw new Error('could not query theatres');
  const rows = await r.json();
  if (!rows.length) throw new Error('no theatres — run migration 003 seed (or add one in Admin)');
  return rows.map((x) => x.name).join(', ');
});

console.log(failures ? `\n${failures} check(s) failed — see DEPLOY.md.` : '\nSupabase is fully connected!');
process.exit(failures ? 1 : 0);
