import { afterAll, describe, expect, test } from "bun:test";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTarballUrl } from "../bin/create-ninots.ts";

function buildFixtureTarball(workDir: string): string {
    const rootName = "ninots-main";
    const fixtureRoot = join(workDir, rootName);
    mkdirSync(join(fixtureRoot, "bootstrap"), { recursive: true });
    mkdirSync(join(fixtureRoot, "app", "Auth"), { recursive: true });
    writeFileSync(
        join(fixtureRoot, "package.json"),
        `${JSON.stringify(
            {
                name: "ninots",
                dependencies: {
                    "@ninots/support": "^0.1.0",
                    "@ninots/session": "^0.2.0",
                    "@ninots/auth": "^0.3.0",
                    "@ninots/social-auth": "^0.1.0",
                },
                devDependencies: {
                    typescript: "^7.0.0",
                },
            },
            null,
            4,
        )}\n`,
    );
    writeFileSync(join(fixtureRoot, "nino"), "#!/usr/bin/env bun\nimport \"./bootstrap/cli.ts\";\n");
    chmodSync(join(fixtureRoot, "nino"), 0o755);
    writeFileSync(join(fixtureRoot, "bootstrap", "cli.ts"), "export {};\n");
    writeFileSync(join(fixtureRoot, "app", "Auth", "createOAuthServices.ts"), "export {};\n");
    // Nested .git must not be copied into the destination.
    mkdirSync(join(fixtureRoot, ".git"), { recursive: true });
    writeFileSync(join(fixtureRoot, ".git", "HEAD"), "ref: refs/heads/main\n");

    const archivePath = join(workDir, "fixture.tar.gz");
    const proc = Bun.spawnSync(["tar", "-czf", archivePath, "-C", workDir, rootName], {
        stdout: "pipe",
        stderr: "pipe",
    });
    expect(proc.exitCode).toBe(0);
    return archivePath;
}

describe("resolveTarballUrl", () => {
    test("defaults to main branch tarball", () => {
        expect(resolveTarballUrl()).toBe(
            "https://codeload.github.com/nino-ts/ninots/tar.gz/refs/heads/main",
        );
        expect(resolveTarballUrl("main")).toBe(
            "https://codeload.github.com/nino-ts/ninots/tar.gz/refs/heads/main",
        );
    });

    test("uses raw sha path for commit SHAs", () => {
        expect(resolveTarballUrl("abcdef1")).toBe(
            "https://codeload.github.com/nino-ts/ninots/tar.gz/abcdef1",
        );
    });
});

describe("create-ninots (local tarball fixture)", () => {
    const workDir = mkdtempSync(join(tmpdir(), "create-ninots-fixture-"));
    const dest = join(tmpdir(), `create-ninots-smoke-${Date.now()}`);
    const archivePath = buildFixtureTarball(workDir);

    afterAll(() => {
        if (existsSync(dest)) {
            rmSync(dest, { force: true, recursive: true });
        }
        if (existsSync(workDir)) {
            rmSync(workDir, { force: true, recursive: true });
        }
    });

    test("extracts fixture, skips .git, patches package.json.name", () => {
        const proc = Bun.spawnSync(["bun", "run", "./bin/create-ninots.ts", dest], {
            cwd: join(import.meta.dir, ".."),
            env: {
                ...process.env,
                CREATE_NINOTS_TARBALL: archivePath,
            },
            stdout: "pipe",
            stderr: "pipe",
        });
        const stderr = new TextDecoder().decode(proc.stderr);
        expect(proc.exitCode).toBe(0);
        expect(stderr).toBe("");
        expect(existsSync(join(dest, "nino"))).toBe(true);
        expect(existsSync(join(dest, "bootstrap", "cli.ts"))).toBe(true);
        expect(existsSync(join(dest, "app", "Auth", "createOAuthServices.ts"))).toBe(true);
        expect(existsSync(join(dest, ".git"))).toBe(false);

        const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")) as {
            name: string;
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        expect(pkg.name).toBe(dest.split(/[/\\]/).pop());
        expect(pkg.devDependencies.typescript).toBe("^7.0.0");
        expect(pkg.dependencies["@ninots/support"]).toBe("^0.1.0");
        expect(pkg.dependencies["@ninots/session"]).toBe("^0.2.0");
        expect(pkg.dependencies["@ninots/auth"]).toBe("^0.3.0");
        expect(pkg.dependencies["@ninots/social-auth"]).toBe("^0.1.0");
        expect(JSON.stringify(pkg)).not.toContain("@ninots/cli");
    });
});

describe("create-ninots (live GitHub smoke)", () => {
    test("scaffolds from nino-ts/ninots main when online", async () => {
        let online = false;
        try {
            const res = await fetch(
                "https://codeload.github.com/nino-ts/ninots/tar.gz/refs/heads/main",
                { method: "HEAD" },
            );
            online = res.ok;
        } catch {
            online = false;
        }
        if (!online) {
            console.warn("skip live GitHub smoke — offline or unreachable");
            return;
        }

        const dest = join(tmpdir(), `create-ninots-live-${Date.now()}`);
        try {
            const proc = Bun.spawnSync(["bun", "run", "./bin/create-ninots.ts", dest], {
                cwd: join(import.meta.dir, ".."),
                env: {
                    ...process.env,
                    CREATE_NINOTS_REF: "main",
                },
                stdout: "pipe",
                stderr: "pipe",
            });
            expect(proc.exitCode).toBe(0);
            expect(existsSync(join(dest, "nino"))).toBe(true);
            expect(existsSync(join(dest, "bootstrap", "cli.ts"))).toBe(true);
            expect(existsSync(join(dest, ".git"))).toBe(false);
            const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")) as {
                name: string;
            };
            expect(pkg.name).toBe(dest.split(/[/\\]/).pop());
        } finally {
            if (existsSync(dest)) {
                rmSync(dest, { force: true, recursive: true });
            }
        }
    }, 120_000);
});
