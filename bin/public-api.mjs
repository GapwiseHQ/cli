const DEFAULT_API = 'https://api.gapwise.ca/v1';

export const help = `Gapwise CLI — campus data and university integration tooling

Usage:
  gapwise universities [--json]
  gapwise campuses [--university ID] [--json]
  gapwise buildings --university ID [--campus ID] [--query TEXT] [--category academic|residence|facility] [--limit N] [--json]
  gapwise residences --university ID [--campus ID] [--limit N] [--json]
  gapwise places --university ID [--campus ID] [--query TEXT] [--kind KIND] [--limit N] [--json]
  gapwise route --university ID --from CODE --to CODE [--campus ID] [--mode fastest|prefer-indoor|step-free] [--json]

Maintainer commands (require sibling gapwise and data repositories):
  gapwise university create|validate|test|dev ID [--workspace PATH]
  gapwise data validate|osm ID [--workspace PATH]

Options:
  --json      Print the full public API response for scripting
  --help      Show this help
  --version   Show the installed CLI version

Public commands use the Gapwise API. University and campus IDs are explicit for
campus queries, so a different edition cannot silently use U of T/UTM data.
Docs: https://docs.gapwise.ca/cli/`;

const publicCommands = new Set(['universities', 'campuses', 'buildings', 'residences', 'places', 'route']);
const allowed = {
  universities: new Set(['--json']),
  campuses: new Set(['--university', '--json']),
  buildings: new Set(['--university', '--campus', '--query', '--category', '--limit', '--json']),
  residences: new Set(['--university', '--campus', '--limit', '--json']),
  places: new Set(['--university', '--campus', '--query', '--kind', '--limit', '--json']),
  route: new Set(['--university', '--campus', '--from', '--to', '--mode', '--json']),
};

function parseOptions(command, argv) {
  const result = {};
  for (let index = 1; index < argv.length; index++) {
    const [key, inline] = argv[index].split(/=(.*)/s, 2);
    if (!allowed[command].has(key)) throw new Error(`Unknown option or argument: ${argv[index]}. Run gapwise --help.`);
    if (Object.hasOwn(result, key)) throw new Error(`Repeated option: ${key}`);
    if (key === '--json') {
      if (inline !== undefined) throw new Error('--json takes no value.');
      result[key] = true;
      continue;
    }
    const value = inline ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${key} needs a value.`);
    result[key] = value;
  }
  return result;
}

function requireId(id, label) {
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Provide a valid ${label} with --${label} ID.`);
}

function apiBase() {
  const base = process.env.GAPWISE_API_BASE_URL ?? DEFAULT_API;
  const url = new URL(base);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('GAPWISE_API_BASE_URL must be an HTTP URL.');
  return url.href.replace(/\/$/, '');
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, { ...options, signal: AbortSignal.timeout(10000) });
  } catch (error) {
    throw new Error(`Gapwise API request failed: ${error.message}. Check your connection and https://status.gapwise.ca.`);
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`Gapwise API returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) {
    const detail = payload.error?.message ?? payload.message ?? response.statusText;
    throw new Error(`Gapwise API error (HTTP ${response.status}): ${detail}${payload.meta?.requestId ? ` [request ${payload.meta.requestId}]` : ''}`);
  }
  return payload;
}

function print(payload, asJson, render) {
  if (asJson) console.log(JSON.stringify(payload, null, 2));
  else render(payload.data);
}

export async function publicCommand(argv) {
  const command = argv[0];
  if (!publicCommands.has(command)) return false;
  const opts = parseOptions(command, argv);
  const asJson = Boolean(opts['--json']);
  if (command === 'universities') {
    const payload = await request('/universities');
    print(payload, asJson, (rows) => rows.forEach((row) => console.log(`${row.id}\t${row.name}\t${row.campuses.join(', ')}\t${row.hosts[0]}`)));
    return true;
  }
  let university;
  if (opts['--university']) {
    requireId(opts['--university'], 'university');
    const directory = await request('/universities');
    university = directory.data.find((entry) => entry.id === opts['--university'] && entry.status === 'supported');
    if (!university) throw new Error(`Unknown or unsupported university: ${opts['--university']}. Run gapwise universities.`);
  } else if (command !== 'campuses') {
    throw new Error(`--university ID is required for ${command}. Run gapwise universities.`);
  }
  const campus = opts['--campus'];
  if (campus && !university.campuses.includes(campus)) {
    throw new Error(`Campus ${campus} does not belong to ${university.name}. Valid campuses: ${university.campuses.join(', ')}.`);
  }
  if (command === 'campuses') {
    const query = university ? `?university=${encodeURIComponent(university.id)}` : '';
    const payload = await request(`/campuses${query}`);
    print(payload, asJson, (rows) => rows.forEach((row) => console.log(`${row.id}\t${row.name}\t${row.universityId}\t${row.routable ? 'routing available' : 'routing unavailable'}`)));
    return true;
  }
  if (opts['--limit'] && (!/^[1-9][0-9]*$/.test(opts['--limit']) || Number(opts['--limit']) > 100)) {
    throw new Error('--limit must be an integer from 1 to 100.');
  }
  if (command === 'route') {
    const selectedCampus = campus ?? university.defaultCampus;
    if (!university.routableCampuses.includes(selectedCampus)) {
      throw new Error(`Routing is unavailable for ${university.name} / ${selectedCampus}. Run gapwise campuses --university ${university.id}.`);
    }
    if (!opts['--from'] || !opts['--to']) throw new Error('route requires --from CODE and --to CODE.');
    const mode = opts['--mode'] ?? 'fastest';
    if (!['fastest', 'prefer-indoor', 'step-free'].includes(mode)) throw new Error(`Unsupported routing mode: ${mode}.`);
    const payload = await request('/routes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: opts['--from'], to: opts['--to'], university: university.id, campus: selectedCampus, preferences: { mode } }),
    });
    print(payload, asJson, (row) => {
      console.log(`${university.name} / ${selectedCampus}: ${row.from?.name ?? opts['--from']} → ${row.to?.name ?? opts['--to']}`);
      console.log(`${row.status}: ${row.totalDistanceMeters ?? 'unknown'} m, ${row.estimatedSeconds ?? 'unknown'} seconds · ${row.routeVerification ?? 'verification unknown'}`);
      for (const warning of row.warnings ?? []) console.log(`Warning: ${typeof warning === 'string' ? warning : JSON.stringify(warning)}`);
    });
    return true;
  }
  const params = new URLSearchParams({ university: university.id, campus: campus ?? university.defaultCampus });
  if (opts['--limit']) params.set('limit', opts['--limit']);
  if (opts['--query']) params.set('q', opts['--query']);
  if (command === 'residences') params.set('category', 'residence');
  if (opts['--category']) {
    if (!['academic', 'residence', 'facility'].includes(opts['--category'])) throw new Error(`Unsupported building category: ${opts['--category']}.`);
    params.set('category', opts['--category']);
  }
  if (opts['--kind']) params.set('kind', opts['--kind']);
  const path = command === 'places' ? '/places' : '/buildings';
  const payload = await request(`${path}?${params}`);
  print(payload, asJson, (rows) => {
    if (!rows.length) console.log(`No ${command} found for ${university.name} / ${campus ?? university.defaultCampus}.`);
    else rows.forEach((row) => console.log(`${row.code ?? row.id}\t${row.name}\t${row.category ?? row.kind ?? ''}`));
    if (payload.meta?.pagination?.nextOffset != null) console.log(`More results available; use the public API for pagination: ${DEFAULT_API}${path}`);
  });
  return true;
}
