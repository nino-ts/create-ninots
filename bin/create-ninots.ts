#!/usr/bin/env bun
/**
 * create-ninots — scaffold a ninoTS app from the GitHub tarball of nino-ts/ninots.
 *
 * Usage:
 *   bun create ninots myapp
 *   bunx create-ninots myapp
 *
 * Env:
 *   CREATE_NINOTS_REF — branch / tag / SHA (default: main)
 *   CREATE_NINOTS_TARBALL — absolute path to a local .tar.gz (tests / offline override)
 */

import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const REPO = "nino-ts/ninots";
const DEFAULT_REF = "main";

function usage(): never {
    console.error(`Usage: bunx create-ninots <project-directory>

Examples:
  bun create ninots myapp
  bunx create-ninots myapp

Env:
  CREATE_NINOTS_REF      Git ref (branch/tag/SHA); default: main
  CREATE_NINOTS_TARBALL  Local .tar.gz path (skips GitHub fetch; for tests)
`);
    process.exit(1);
}

function isEmptyDir(path: string): boolean {
    if (!existsSync(path)) {
        return true;
    }
    return readdirSync(path).length === 0;
}

function isGitSha(ref: string): boolean {
    return /^[0-9a-f]{7,40}$/i.test(ref);
}

/** Build codeload.github.com tarball URL for a ref. */
export function resolveTarballUrl(ref: string = DEFAULT_REF): string {
    if (isGitSha(ref)) {
        return `https://codeload.github.com/${REPO}/tar.gz/${ref}`;
    }
    if (ref.startsWith("refs/")) {
        return `https://codeload.github.com/${REPO}/tar.gz/${ref}`;
    }
    return `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${ref}`;
}

function copyTree(from: string, to: string): void {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") {
            continue;
        }
        const src = join(from, entry.name);
        const dest = join(to, entry.name);
        if (entry.isDirectory()) {
            copyTree(src, dest);
        } else {
            cpSync(src, dest);
        }
    }
}

export function patchPackageName(projectDir: string, name: string): void {
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

function findArchiveRoot(extractDir: string): string {
    const entries = readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (entries.length === 1) {
        return join(extractDir, entries[0].name);
    }
    // Flat extract (unlikely for GitHub) — use extractDir itself if it looks like a starter.
    if (existsSync(join(extractDir, "package.json"))) {
        return extractDir;
    }
    throw new Error(
        `create-ninots: unexpected tarball layout under ${extractDir} (expected single root dir)`,
    );
}

async function downloadTarball(url: string, destFile: string): Promise<void> {
    let response: Response;
    try {
        response = await fetch(url);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
            `create-ninots: failed to fetch starter tarball from GitHub (${url}): ${message}. Check network access.`,
        );
    }
    if (!response.ok) {
        throw new Error(
            `create-ninots: GitHub returned HTTP ${response.status} for ${url}. Check CREATE_NINOTS_REF and that nino-ts/ninots is reachable.`,
        );
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destFile, buffer);
}

function extractTarGz(archivePath: string, extractDir: string): void {
    mkdirSync(extractDir, { recursive: true });
    const proc = Bun.spawnSync(["tar", "-xzf", archivePath, "-C", extractDir], {
        stdout: "pipe",
        stderr: "pipe",
    });
    if (proc.exitCode !== 0) {
        const stderr = new TextDecoder().decode(proc.stderr).trim();
        throw new Error(
            `create-ninots: tar extract failed (exit ${proc.exitCode})${stderr ? `: ${stderr}` : ""}`,
        );
    }
}

export async function scaffoldFromTarball(options: {
    projectDir: string;
    projectName: string;
    ref?: string;
    localTarball?: string;
}): Promise<void> {
    const workRoot = mkdtempSync(join(tmpdir(), "create-ninots-"));
    const archivePath = join(workRoot, "ninots.tar.gz");
    const extractDir = join(workRoot, "extract");

    try {
        const local = options.localTarball;
        if (local) {
            if (!existsSync(local) || !statSync(local).isFile()) {
                throw new Error(`create-ninots: CREATE_NINOTS_TARBALL not found: ${local}`);
            }
            cpSync(local, archivePath);
        } else {
            const ref = options.ref ?? DEFAULT_REF;
            const url = resolveTarballUrl(ref);
            console.log(`Downloading ninoTS starter (${ref})…`);
            await downloadTarball(url, archivePath);
        }

        extractTarGz(archivePath, extractDir);
        const sourceRoot = findArchiveRoot(extractDir);

        if (!existsSync(join(sourceRoot, "package.json"))) {
            throw new Error("create-ninots: tarball root missing package.json");
        }

        copyTree(sourceRoot, options.projectDir);
        patchPackageName(options.projectDir, options.projectName);
    } finally {
        rmSync(workRoot, { force: true, recursive: true });
    }
}

async function main(): Promise<void> {
    const targetArg = process.argv[2];
    if (!targetArg || targetArg === "--help" || targetArg === "-h") {
        usage();
    }

    const projectDir = resolve(process.cwd(), targetArg);
    const projectName = basename(projectDir);

    if (existsSync(projectDir) && !isEmptyDir(projectDir)) {
        console.error(`create-ninots: destination is not empty: ${projectDir}`);
        process.exit(1);
    }

    const ref = process.env.CREATE_NINOTS_REF?.trim() || DEFAULT_REF;
    const localTarball = process.env.CREATE_NINOTS_TARBALL?.trim() || undefined;

    console.log(`Scaffolding ninoTS app in ${projectDir}…`);
    try {
        await scaffoldFromTarball({ projectDir, projectName, ref, localTarball });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exit(1);
    }

    console.log(`
Done.

  cd ${targetArg}
  bun install
  bun run dev

Scaffold source: GitHub tarball nino-ts/ninots (ref=${localTarball ? "local" : ref}).
Uses TypeScript ^7 and published @ninots/* (no umbrella / @ninots/cli). CLI entry: ./nino.
`);
}

if (import.meta.main) {
    await main();
}
