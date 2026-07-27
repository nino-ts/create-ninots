#!/usr/bin/env bun
/**
 * create-ninots — scaffold a clean ninoTS starter (TS 7 + @ninots/*@^0.1.0).
 *
 * Usage:
 *   bun create ninots myapp
 *   bunx create-ninots myapp
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const TEMPLATE_DIR = resolve(import.meta.dir, "..", "template");

function usage(): never {
    console.error(`Usage: bunx create-ninots <project-directory>

Examples:
  bun create ninots myapp
  bunx create-ninots myapp
`);
    process.exit(1);
}

function isEmptyDir(path: string): boolean {
    if (!existsSync(path)) {
        return true;
    }
    return readdirSync(path).length === 0;
}

function copyTemplate(from: string, to: string): void {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") {
            continue;
        }
        const src = join(from, entry.name);
        const dest = join(to, entry.name);
        if (entry.isDirectory()) {
            copyTemplate(src, dest);
        } else {
            cpSync(src, dest);
        }
    }
}

function patchPackageName(projectDir: string, name: string): void {
    const packagePath = join(projectDir, "package.json");
    const raw = readFileSync(packagePath, "utf8");
    const pkg = JSON.parse(raw) as {
        name?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    pkg.name = name;
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 4)}\n`);
}

function main(): void {
    const targetArg = process.argv[2];
    if (!targetArg || targetArg === "--help" || targetArg === "-h") {
        usage();
    }

    if (!existsSync(TEMPLATE_DIR) || !statSync(TEMPLATE_DIR).isDirectory()) {
        console.error(`create-ninots: embedded template missing at ${TEMPLATE_DIR}`);
        process.exit(1);
    }

    const projectDir = resolve(process.cwd(), targetArg);
    const projectName = basename(projectDir);

    if (existsSync(projectDir) && !isEmptyDir(projectDir)) {
        console.error(`create-ninots: destination is not empty: ${projectDir}`);
        process.exit(1);
    }

    console.log(`Scaffolding ninoTS app in ${projectDir}…`);
    copyTemplate(TEMPLATE_DIR, projectDir);
    patchPackageName(projectDir, projectName);

    console.log(`
Done.

  cd ${targetArg}
  bun install
  bun run dev

Uses TypeScript ^7 and @ninots/*@^0.1.0. CLI entry: ./nino (no @ninots/cli).
`);
}

main();
