import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("create-ninots", () => {
    const dest = join(tmpdir(), `create-ninots-smoke-${Date.now()}`);

    afterAll(() => {
        if (existsSync(dest)) {
            rmSync(dest, { force: true, recursive: true });
        }
    });

    test("scaffolds template with TS7, session/auth ^0.2.0", () => {
        const proc = Bun.spawnSync(["bun", "run", "./bin/create-ninots.ts", dest], {
            cwd: join(import.meta.dir, ".."),
            stdout: "pipe",
            stderr: "pipe",
        });
        expect(proc.exitCode).toBe(0);
        expect(existsSync(join(dest, "nino"))).toBe(true);
        expect(existsSync(join(dest, "bootstrap", "cli.ts"))).toBe(true);
        expect(existsSync(join(dest, ".git"))).toBe(false);

        const pkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf8")) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        expect(pkg.devDependencies.typescript).toBe("^7.0.0");
        expect(pkg.dependencies["@ninots/support"]).toBe("^0.1.0");
        expect(pkg.dependencies["@ninots/session"]).toBe("^0.2.0");
        expect(pkg.dependencies["@ninots/auth"]).toBe("^0.2.0");
        expect(JSON.stringify(pkg)).not.toContain("@ninots/cli");
    });
});
