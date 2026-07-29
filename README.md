# create-ninots

Scaffold a new [ninoTS](https://github.com/nino-ts/ninots) application.

```sh
bun create ninots myapp
cd myapp
bun install
bun run dev
```

Equivalent: `bunx create-ninots myapp`.

## What you get

- Clean starter (no `.git` from the template)
- TypeScript `^7.0.0`
- Direct `@ninots/*` dependencies (session/auth `^0.2.0`; others `^0.1.0` — no umbrella / `@ninots/cli`)
- Local `./nino` CLI via `@ninots/console`

## License

MIT
