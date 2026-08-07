# create-ninots

Scaffold a new [ninoTS](https://github.com/nino-ts/ninots) application from the **GitHub tarball** of `nino-ts/ninots` (no embedded template).

```sh
bun create ninots myapp
cd myapp
bun install
bun run dev
```

Equivalent: `bunx create-ninots myapp`.

## How it works

1. Fetches `https://codeload.github.com/nino-ts/ninots/tar.gz/refs/heads/main` (Bun `fetch`)
2. Extracts with system `tar`
3. Copies the starter into your project directory (skips `.git` / `node_modules`)
4. Patches `package.json` `name` to the directory basename

Requires network access to GitHub. There is **no** offline embedded fallback.

### Optional env

| Variable | Effect |
|----------|--------|
| `CREATE_NINOTS_REF` | Branch, `refs/…`, or commit SHA (default: `main`) |
| `CREATE_NINOTS_TARBALL` | Absolute path to a local `.tar.gz` (skips fetch; used in tests) |

## What you get

- Clean starter (no `.git` from the archive)
- TypeScript `^7.0.0`
- Direct published `@ninots/*` dependencies (npm only — no JSR)
- Local `./nino` CLI via `@ninots/console` (no `@ninots/cli`)

## License

MIT
