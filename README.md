<div align="center">

<img src="assets/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise CLI

### Repeatable university integrations for one Gapwise product.

[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)
[![CI](https://github.com/GapwiseHQ/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/GapwiseHQ/cli/actions/workflows/ci.yml)

</div>

## Purpose

The CLI scaffolds a university manifest entry, timetable adapter, test, and empty campus data files in the sibling [`gapwise`](https://github.com/GapwiseHQ/gapwise) and [`data`](https://github.com/GapwiseHQ/data) repositories. It also creates the app's empty campus mirror and map catalog so the generic campus loader discovers the new ID. It never copies application screens. Generated data contains no invented buildings, entrances, or routes.

## Installation

Requires Node 24, Bun 1.3.14 for application tests, and sibling `gapwise` and `data` checkouts. The canonical CLI source is [GapwiseHQ/cli](https://github.com/GapwiseHQ/cli). Install directly from that repository:

```sh
npm install -g github:GapwiseHQ/cli
gapwise university create example-university --dry-run
```

To work on the CLI itself, clone this repository and run `npm test` or `node bin/gapwise.mjs`. By default, commands expect `cli`, `gapwise`, and `data` as sibling directories. Set `GAPWISE_WORKSPACE` or pass `--workspace /path/to/workspace` to point to their parent directory.

## Usage

```sh
gapwise university create example-university --name "Example University" --short-name Example --dry-run
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

Use a focused PR, cite data sources and their redistribution terms, and keep unknown access facts unknown. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [Gapwise documentation](https://docs.gapwise.ca).

## License

CLI code is MIT licensed. Campus datasets retain their source specific rights and attribution.
