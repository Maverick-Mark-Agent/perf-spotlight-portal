import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const [,, csvPath, monthArg] = process.argv;
if (!csvPath || !monthArg) {
  console.error('Usage: node scripts/import-zip-codes.mjs "<abs_csv_path>" <YYYY-MM>');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Adjust these to your CSV headers
const CLIENT_COL = 'Client';
const ZIP_COL = 'ZIP';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const cIdx = headers.findIndex(h => h === CLIENT_COL);
  const zIdx = headers.findIndex(h => h === ZIP_COL);
  if (cIdx === -1 || zIdx === -1) throw new Error(`CSV missing required columns: ${CLIENT_COL}, ${ZIP_COL}`);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const client_name = cols[cIdx];
    const zip = cols[zIdx];
    if (client_name && zip) rows.push({ client_name, zip });
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


