<div align="center">

<img src="assets/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise CLI

### Repeatable university integrations for one Gapwise product.

[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)

</div>

## Purpose

The CLI scaffolds a university manifest entry, timetable adapter, test, and empty campus data files in the sibling `gapwise` and `data` repositories. It also creates the app's empty campus mirror and map catalog so the generic campus loader discovers the new ID. It never copies application screens. Generated data contains no invented buildings, entrances, or routes.

## Installation

Requires Node 24, Bun 1.3.14 for application tests, and sibling `gapwise` and `data` checkouts.

```sh
npm install -g .
# Or run without global installation:
node bin/gapwise.mjs university create example-university --dry-run
```

Set `GAPWISE_WORKSPACE` or pass `--workspace /path/to/workspace` if the repositories are elsewhere.

## Usage

```sh
gapwise university create tmu --name "Toronto Metropolitan University" --short-name TMU
gapwise university validate carleton
gapwise university test carleton
gapwise university dev carleton
gapwise data validate carleton
gapwise data osm tmu --bbox=-79.39,43.65,-79.37,43.67
```

`university create <id> --dry-run` lists its changes without writing. A new integration starts with `status: scaffold`, an adapter that throws, an unfinished test, and empty campus data. Review the manifest, implement the adapter, add permitted source backed data, replace the test, and change the status before validation. `university dev` prints the local URL with `?university=<id>` and starts the canonical app.

`data osm` saves an **unreviewed candidate** from an explicit OpenStreetMap bounding box. Use `--input extract.osm` for a reproducible local XML extract and `--output path.json` to choose the output. It does not promote candidate paths or entrances into routable campus data. Review identities, rights, entrances, and connectivity before editing the canonical snapshot.

## Architecture

`gapwise/universities.json` is the deployment and tooling manifest. `gapwise/src/universities/` holds timetable adapters. `data/universities/` holds validated campus snapshots and provenance. Run `bun scripts/sync-campus-data.ts --write` in `gapwise` after changing canonical data; the campus loader discovers generated catalogs. Shared screens and route UI remain in `gapwise/src/components` and `gapwise/src/features`.

## Development

```sh
npm test
node bin/gapwise.mjs university create example-university --dry-run
```

## Contributing

Use a focused PR, cite data sources and their redistribution terms, and keep unknown access facts unknown. See the Gapwise contributor guide in `gapwise`.

## License

CLI code is MIT licensed. Campus datasets retain their source specific rights and attribution.
