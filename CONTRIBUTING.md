# Contributing to Gapwise CLI

Gapwise CLI helps maintain university integrations across the [Gapwise ecosystem](https://github.com/GapwiseHQ). Open a focused pull request with the related issue, the campus data sources, and the checks you ran.

## Local checks

Requires Node.js 24 or newer. Run `npm test`, `npm pack --dry-run`, and `git diff --check` before opening a pull request. The tests use a small, committed workspace fixture so they run without sibling repositories. Also try the command against current `gapwise` and `data` checkouts when changing scaffolding or validation behavior.

Keep generated data empty until sources have been reviewed. Do not invent building identities, entrances, routes, or accessibility facts. Report vulnerabilities privately through [SECURITY.md](SECURITY.md).
