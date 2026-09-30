<div align="center">

<img src="https://raw.githubusercontent.com/GapwiseHQ/cli/main/assets/logo-mark.svg" width="116" alt="Gapwise deer mark" />

# Gapwise CLI

Explore supported universities and campus data, or scaffold a new Gapwise integration.

[![MIT](https://img.shields.io/badge/License-MIT-111111?style=for-the-badge)](LICENSE)
[![CI](https://github.com/GapwiseHQ/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/GapwiseHQ/cli/actions/workflows/ci.yml)

</div>

The official CLI uses the [Gapwise public API](https://api.gapwise.ca/v1) for campus discovery, buildings, places, residences, and routes. Its maintainer commands work with sibling [`gapwise`](https://github.com/GapwiseHQ/gapwise) and [`data`](https://github.com/GapwiseHQ/data) checkouts. Gapwise supports 13 Canadian universities and 15 campus models; routing and place coverage vary by campus. No university affiliation is implied.

## Install

Requires **Node.js 22 or newer**. Install the current verified [`@gapwise/cli` package from npm](https://www.npmjs.com/package/@gapwise/cli):

```sh
npm install -g @gapwise/cli@0.2.1
gapwise --version
gapwise --help
```

Upgrade with `npm install -g @gapwise/cli@latest`. To uninstall, run `npm uninstall -g @gapwise/cli`.

## Explore the public platform

```sh
gapwise universities
gapwise campuses --university uoft
gapwise campuses --university york
gapwise buildings --university carleton --query library
gapwise residences --university tmu
gapwise places --university uoft --campus utm --kind study
gapwise route --university carleton --from TB --to ML
gapwise buildings --university york --category residence --json
```

`--json` prints the full public API `{ data, meta }` response to stdout. Human output uses tab-separated columns for discovery and lists. Errors go to stderr and return a nonzero exit code. Campus queries require `--university`; when `--campus` is omitted, the selected university's default campus is used. For pagination, advanced filtering, and stable application integration, use the [API](https://docs.gapwise.ca/api/) or official [SDKs](https://docs.gapwise.ca/sdk/javascript/) directly. The CLI does not bypass API coverage or access private student data.

## Integrate a new university

Clone `cli`, `gapwise`, and `data` as sibling repositories, or pass their parent directory with `--workspace` (also available as `GAPWISE_WORKSPACE`). Maintainer validation and development need the runtimes required by those repositories, including Bun for the app tests.

```sh
gapwise university create example-university --name "Example University" --short-name Example --dry-run
gapwise university validate carleton
gapwise university test carleton
gapwise university dev carleton
gapwise data validate carleton
gapwise data osm tmu --bbox=-79.39,43.65,-79.37,43.67
```

`university create --dry-run` lists its changes without writing. A new integration starts as a scaffold with an unimplemented adapter and empty campus data. Review the manifest, implement the adapter, add permitted source-backed data, replace the placeholder test, and change the status before validation. No application UI is copied or invented campus facts added. `data osm` saves an **unreviewed candidate** from an explicit OpenStreetMap bounding box; use `--input extract.osm` for a reproducible local XML extract. Candidate paths and entrances are not automatically promoted into routable data.

## Development and release

```sh
npm run check
```

`check` runs unit tests, packs the npm artifact, checks its contents and size, performs a clean global install, and executes the installed binary. CI runs it on Node 22 and 24. [Release guidance](RELEASING.md) describes versioning, the initial npm owner bootstrap, and subsequent OIDC Trusted Publishing with provenance. The CLI has no runtime dependencies.

Read the [CLI guide](https://docs.gapwise.ca/cli/), [developer documentation](https://docs.gapwise.ca/), [contribution guide](CONTRIBUTING.md), and [security policy](SECURITY.md). Gapwise itself is at [gapwise.ca](https://gapwise.ca).

## License

CLI code is [MIT licensed](LICENSE). Campus datasets retain their source-specific rights and attribution.
