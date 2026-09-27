# Releasing Gapwise CLI

`@gapwise/cli` is the intended public npm identity. The canonical source is [GapwiseHQ/cli](https://github.com/GapwiseHQ/cli). A release is the same version in `package.json`, the npm registry, the `vX.Y.Z` Git tag, and GitHub Releases.

## Prepare a release

1. Make changes on a feature branch, run `npm run check`, and merge a green PR to `main` without bypassing protection.
2. Update `package.json` with the intended SemVer version in the PR. Describe user-visible changes in the PR.
3. Verify `npm pack --dry-run` and a clean install of the artifact; `npm run check` does both.
4. Check that the npm version is unused before creating the tag.

The tag workflow tests on Node 24, verifies the tag matches `package.json` and points to a commit on `main`, publishes via npm Trusted Publishing if the version does not already exist, independently installs the registry package, and creates a GitHub Release. CI also tests Node 22. The workflow never stores a publish token. npm supplies provenance automatically for a public package published from the public GitHub repository through its trusted publisher.

## First npm publication

The first release requires an account that can publish under `@gapwise`; this repository cannot grant npm ownership. The current agent environment has no authenticated npm account. From a clean checkout of merged `main`, the npm owner should:

```sh
npm login
npm whoami
npm run check
npm publish --access public
```

The intended first version is `0.2.0`; check `package.json` before publishing and do not publish from an old checkout. If npm reports scope ownership, organization, billing, or OTP requirements, resolve those requirements in npm. Do not publish under a personal scope as a substitute. After the first release appears on the registry, add an npm Trusted Publisher in the `@gapwise/cli` package settings:

- Provider: GitHub Actions
- Organization/user: `GapwiseHQ`
- Repository: `cli`
- Workflow filename: `release.yml`
- Allowed action: direct `npm publish`

Then create and push an annotated `v0.2.0` tag on the same merged `main` commit. The workflow checks the existing registry version, verifies its install, and creates the corresponding GitHub Release. Subsequent new versions publish from the tag workflow through OIDC and get npm provenance. Keep the initial manual publish distinct from provenance-bearing OIDC releases; do not claim provenance for the manual first release.

If an npm owner authorizes this workspace with an interactive login, the maintainer can complete the first publish here and perform the external verification. Never commit auth tokens or `.npmrc` credentials.
