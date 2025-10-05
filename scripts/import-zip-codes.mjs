import fs from 'fs/promises';
import fsSync from 'fs';
import { createClient } from '@supabase/supabase-js';

// Args: <csvPath> <YYYY-MM> [--client-col "Client Name"] [--zip-col "Zip"]
const args = process.argv.slice(2);
const csvPath = args[0];
const monthArg = args[1];
if (!csvPath || !monthArg) {
  console.error('Usage: node scripts/import-zip-codes.mjs "<abs_csv_path>" <YYYY-MM> [--client-col "Client"] [--zip-col "ZIP"]');
  process.exit(1);
}
let CLIENT_COL = 'Client';
let ZIP_COL = 'ZIP';
for (let i = 2; i < args.length; i++) {
  if (args[i] === '--client-col' && args[i + 1]) {
    CLIENT_COL = args[i + 1];
    i++;
  } else if (args[i] === '--zip-col' && args[i + 1]) {
    ZIP_COL = args[i + 1];
    i++;
  }
}

// Attempt to auto-load .env if envs are missing
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const envText = fsSync.readFileSync('.env', 'utf8');
    envText.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2];
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch {}
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const rawHeaders = lines[0].split(',');
  const headers = rawHeaders.map(h => h.trim());
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalized = headers.map(norm);

  // Build candidate lists (include user-provided names and common variants)
  const clientCandidates = [norm(CLIENT_COL), 'client', 'clientname', 'name', 'territory', 'agency', 'workspace'];
  const zipCandidates = [norm(ZIP_COL), 'zip', 'zipcode', 'zip_code', 'zipcodes', 'postal', 'postalcode'];

  const findIdx = (candidates) => {
    for (const c of candidates) {
      const idx = normalized.findIndex(h => h === c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const cIdx = findIdx(clientCandidates); // allow -1 → UNKNOWN client
  const zIdx = findIdx(zipCandidates);
  if (zIdx === -1) throw new Error(`CSV missing required ZIP column. Tried variants: ${zipCandidates.join(', ')}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    while (cols.length < headers.length) cols.push('');
    const get = (idx) => (cols[idx] || '').trim();
    const client_name = cIdx !== -1 ? get(cIdx) : 'UNKNOWN';
    const zipRaw = get(zIdx);
    const zip = zipRaw.replace(/[^0-9]/g, '');
    if (zip) rows.push({ client_name, zip });
  }
  return rows;
}

async function resolveWorkspaceName(clientName) {
  const { data, error } = await supabase.from('client_registry')
    .select('workspace_name, display_name')
    .or(`workspace_name.eq.${clientName},display_name.eq.${clientName}`)
    .limit(1);
  if (error) return null;
  return data?.[0]?.workspace_name || null;
}

(async () => {
  const text = await fs.readFile(csvPath, 'utf8');
  const rows = parseCSV(text);
  const month = monthArg;

  const cache = new Map();
  const payload = [];
  for (const r of rows) {
    let ws = cache.get(r.client_name);
    if (ws === undefined) {
      ws = await resolveWorkspaceName(r.client_name);
      cache.set(r.client_name, ws);
    }
    payload.push({
      client_name: r.client_name,
      workspace_name: ws,
      month,
      zip: r.zip,
      source: 'csv'
    });
  }

  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from('client_zipcodes').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  console.log(`Imported ${inserted} rows for month ${month}`);
})();


