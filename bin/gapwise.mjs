#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { help, publicCommand } from './public-api.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultWorkspace = resolve(scriptDir, '../..');
const validId = /^[a-z][a-z0-9-]*$/;

function option(args, name) {
  const equal = args.find((arg) => arg.startsWith(`${name}=`));
  if (equal) return equal.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}

export function universityPlan(id, workspace, args = []) {
  if (!validId.test(id)) throw new Error('University ID must be lowercase letters, numbers, or hyphens.');
  const app = join(workspace, 'gapwise');
  const data = join(workspace, 'data');
  const manifestPath = join(app, 'universities.json');
  const adapterRegistryPath = join(app, 'src/universities/timetable-adapters.ts');
  const catalogRegistryPath = join(app, 'src/data/campuses/index.ts');
  if (!existsSync(manifestPath) || !existsSync(adapterRegistryPath) || !existsSync(catalogRegistryPath) || !existsSync(join(data, 'schemas/universities/campus.schema.json')))
    throw new Error('Workspace needs sibling gapwise and data repositories with the university contract.');
  const manifest = readJson(manifestPath);
  if (manifest.universities.some((entry) => entry.id === id)) throw new Error(`${id} is already registered.`);
  const name = option(args, '--name') ?? (id.length <= 4 ? id.toUpperCase() : id.replace(/(^|-)[a-z]/g, (match) => match.replace('-', ' ').toUpperCase()));
  const shortName = option(args, '--short-name') ?? name;
  if (![name, shortName].every((value) => value.trim() && !/[\x00-\x1f\x7f]/.test(value) && !value.includes('*/')))
    throw new Error('University name and short name must be single-line text.');
  const host = option(args, '--host') ?? `${id}.gapwise.ca`;
  if (!/^[a-z0-9.-]+$/.test(host) || manifest.universities.some((entry) => entry.hosts.includes(host)))
    throw new Error('Host must be a unique lowercase DNS hostname.');
  const integration = join(app, `src/universities/${id}`);
  const dataDir = join(data, `universities/${id}`);
  if (existsSync(integration) || existsSync(dataDir)) throw new Error(`${id} files already exist.`);
  const registry = readFileSync(adapterRegistryPath, 'utf8');
  const catalogRegistry = readFileSync(catalogRegistryPath, 'utf8');
  const marker = '  // GAPWISE_ADAPTER_REGISTRY: the CLI inserts new timetable adapters here.';
  const demoMarker = '  // GAPWISE_DEMO_LOADER_REGISTRY: the CLI inserts new demo loaders here.';
  const catalogMarker = '  // GAPWISE_CAMPUS_CATALOG_REGISTRY: the CLI inserts new catalog imports here.';
  if (!registry.includes(marker)) throw new Error('Adapter registry marker is missing.');
  if (!catalogRegistry.includes(catalogMarker)) throw new Error('Campus catalog registry marker is missing.');
  manifest.universities.push({
    id, name, shortName, hosts: [host], campuses: [id], defaultCampus: id,
    timetableAdapter: `${id}-schedule`, calendarSource: name,
    calendarInstructions: `Choose a ${name} class calendar (.ics) or paste schedule text.`,
    calendarHelpUrl: '/support',
    enabledFeatures: { routing: false, liveLocation: false }, routableCampuses: [],
    dataPaths: [`universities/${id}/campus.json`], status: 'scaffold',
  });
  const pascalName = id.replace(/(^|-)[a-z]/g, (match) => match.replace('-', '').toUpperCase());
  const adapter = `import type { ParsedTimetable, Meeting } from '@/lib/timetable-types';\n\n/** Implement ${name} ingestion and normalize every meeting into ParsedTimetable. */\nexport async function parseTimetable(_text: string): Promise<ParsedTimetable> {\n  throw new Error(${JSON.stringify(`${name} timetable ingestion has not been implemented.`)});\n}\n\nexport async function load${pascalName}DemoTimetable(): Promise<Meeting[]> {\n  return [];\n}\n`;
  const adapterTest = `import { test } from 'bun:test';\n\ntest('${id} timetable adapter normalizes a real source fixture', () => {\n  throw new Error('Add a permitted timetable fixture and verify canonical meeting output.');\n});\n`;
  const demoTimetable = `import type { Meeting } from '../common/model';\n\nexport const DEMO_${id.toUpperCase().replaceAll('-', '_')}_MEETINGS: Meeting[] = [];\n`;
  const sourcesDoc = `# ${name} Data Sources and Verification\n\n- Institution: ${name} (${id})\n- Date: ${new Date().toISOString().slice(0, 10)}\n- Verification: Pending review\n\n## Sources\n\n1. Official campus directory and open datasets\n2. OpenStreetMap campus elements\n`;
  let newRegistry = registry.replace(marker, `  "${id}-schedule": async (text) => (await import("./${id}/adapter")).parseTimetable(text),\n${marker}`);
  if (registry.includes(demoMarker)) {
    newRegistry = newRegistry.replace(demoMarker, `  "${id}-schedule": async () => (await import("./${id}/adapter")).load${pascalName}DemoTimetable(),\n${demoMarker}`);
  }
  const newCatalogRegistry = catalogRegistry
    .replace('import carletonCatalogRaw from "./carleton/catalog.json?raw";',
      `import carletonCatalogRaw from "./carleton/catalog.json?raw";\nimport ${id.replaceAll('-', '_')}CatalogRaw from "./${id}/catalog.json?raw";`)
    .replace(catalogMarker, `  "${id}": ${id.replaceAll('-', '_')}CatalogRaw,\n${catalogMarker}`);
  const campus = { schemaVersion: 1, institution: id,
    campus: { id, name: `${name} campus`, bounds: null }, sources: [], buildings: [],
    entrances: [], pathNodes: [], pathEdges: [] };
  const academic = { schemaVersion: 1, institution: id, sources: [], terms: [], courses: [] };
  const catalog = { campus: campus.campus, sources: [], buildings: [], entrances: [] };
  return [
    [manifestPath, json(manifest)],
    [adapterRegistryPath, newRegistry],
    [catalogRegistryPath, newCatalogRegistry],
    [join(integration, 'adapter.ts'), adapter],
    [join(integration, 'adapter.test.ts'), adapterTest],
    [join(integration, 'demo-timetable.ts'), demoTimetable],
    [join(dataDir, 'campus.json'), json(campus)],
    [join(dataDir, 'academic.json'), json(academic)],
    [join(data, `docs/universities/${id}-sources.md`), sourcesDoc],
    [join(app, `src/data/campuses/${id}/campus.json`), json(campus)],
    [join(app, `src/data/campuses/${id}/catalog.json`), json(catalog)],
  ];
}

function create(id, workspace, args) {
  const plan = universityPlan(id, workspace, args);
  if (args.includes('--dry-run')) {
    console.log(`Dry run for ${id}:`);
    for (const [path] of plan) console.log(`  ${path.replace(`${workspace}/`, '')}`);
    console.log('No application UI files are created or modified.');
    return;
  }
  for (const [path, contents] of plan) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  console.log(`Scaffolded ${id}. Review the manifest, add permitted data and sources, implement the adapter and its test, then validate.`);
}

function validate(id, workspace) {
  if (!validId.test(id)) throw new Error('Invalid university ID.');
  const app = join(workspace, 'gapwise');
  const data = join(workspace, 'data');
  const manifest = readJson(join(app, 'universities.json'));
  const university = manifest.universities.find((entry) => entry.id === id);
  if (!university) throw new Error(`${id} is not registered.`);
  if (university.status === 'scaffold') throw new Error(`${id} is still a scaffold; implement and review it before activation.`);
  if (!university.hosts.length || !university.campuses.includes(university.defaultCampus))
    throw new Error(`${id} has malformed host or campus configuration.`);
  if (!existsSync(join(app, `src/universities/${id}/adapter.ts`)) && id !== 'uoft')
    throw new Error(`${id} timetable adapter is missing.`);
  const registry = readFileSync(join(app, 'src/universities/timetable-adapters.ts'), 'utf8');
  if (!registry.includes(`"${university.timetableAdapter}"`)) throw new Error(`${id} adapter is not registered.`);
  const campusPath = join(data, `universities/${id}/campus.json`);
  if (id !== 'uoft' && !existsSync(campusPath)) throw new Error(`${id} campus data is missing.`);
  if (id !== 'uoft') run('node', ['scripts/validate-university-data.mjs', id], data);
  console.log(`${id} configuration and data are valid.`);
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(help);
    return;
  }
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    console.log(readJson(join(scriptDir, '../package.json')).version);
    return;
  }
  if (['universities', 'campuses', 'buildings', 'residences', 'places', 'route'].includes(argv[0])) {
    return publicCommand(argv);
  }
  const workspace = resolve(option(argv, '--workspace') ?? process.env.GAPWISE_WORKSPACE ?? defaultWorkspace);
  const [area, action, id] = argv;
  if (area === 'university' && action === 'create' && id) return create(id, workspace, argv);
  if (area === 'university' && action === 'validate' && id) return validate(id, workspace);
  if (area === 'university' && action === 'test' && id) {
    validate(id, workspace);
    const adapterTest = join(workspace, `gapwise/src/universities/${id}/adapter.test.ts`);
    run('bun', ['test', 'tests/universities.test.ts', ...(existsSync(adapterTest) ? [adapterTest] : [])], join(workspace, 'gapwise'));
    return;
  }
  if (area === 'university' && action === 'dev' && id) {
    if (!readJson(join(workspace, 'gapwise/universities.json')).universities.some((entry) => entry.id === id))
      throw new Error(`${id} is not registered.`);
    console.log(`Open http://localhost:5173/?university=${id}`);
    run('bun', ['run', 'dev', '--host', '127.0.0.1'], join(workspace, 'gapwise'));
    return;
  }
  if (area === 'data' && action === 'validate' && id) {
    if (!validId.test(id)) throw new Error('Invalid university ID.');
    run('node', ['scripts/validate-university-data.mjs', id], join(workspace, 'data'));
    return;
  }
  if (area === 'data' && action === 'osm' && id) {
    if (!validId.test(id)) throw new Error('Invalid university ID.');
    const bbox = option(argv, '--bbox');
    if (!bbox) throw new Error('Provide --bbox=west,south,east,north after reviewing the campus boundary.');
    const input = option(argv, '--input');
    const output = option(argv, '--output') ?? join(workspace, `data/universities/${id}/candidates/osm-${new Date().toISOString().slice(0, 10)}.json`);
    run('python3', ['scripts/osm-candidates.py', id, '--bbox', bbox, '--output', output, ...(input ? ['--input', input] : [])], join(workspace, 'data'));
    return;
  }
  throw new Error('Usage: gapwise university create|validate|dev|test <id> [--dry-run] [--workspace PATH]\n       gapwise data validate|osm <id>');
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(() => main()).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
