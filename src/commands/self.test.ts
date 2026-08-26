import assert from "node:assert/strict";
import test from "node:test";
import { selfCommand } from "./self.js";

const skillStatus = {
  skill: "seaagent-cli",
  bundledPath: "/bundle/seaagent-cli",
  localPath: "/local/seaagent-cli",
  cachePath: "/cache/update-check.json",
  bundledVersion: "2026.08.14",
  localVersion: "2026.07.30",
  bundledHash: "bundled-hash",
  localHash: "local-hash",
  installed: true,
  upToDate: true,
};

async function runUpdate(command: ReturnType<typeof selfCommand>): Promise<void> {
  await command.parseAsync(["update"], { from: "user" });
}

test("self update refreshes the bundled skill even when the CLI is current", async () => {
  let updateCliCalled = false;
  let updateSkillCalled = false;
  const outputs: unknown[] = [];
  const command = selfCommand({
    getCliUpdateStatus: async () => ({
      name: "@seaart/sea-agent-cli",
      currentVersion: "0.1.0",
      localCommit: "local",
      remoteCommit: "remote",
      remoteURL: "https://example.invalid/remote",
      githubRepo: "SeaArt-Infra/sea-agent-cli",
      githubBranch: "sync-github-main",
      installSpec: "git+https://example.invalid/sea-agent-cli.git",
      cachePath: "/cache/cli-update.json",
      checkedAt: "2026-08-14T00:00:00.000Z",
      status: "up-to-date",
      updateAvailable: false,
    }),
    updateCliPackage: async () => {
      updateCliCalled = true;
      throw new Error("should not update the CLI");
    },
    updateLocalSkill: async () => {
      updateSkillCalled = true;
      return skillStatus;
    },
    printJSON: (value) => outputs.push(value),
  });

  await runUpdate(command);

  assert.equal(updateCliCalled, false);
  assert.equal(updateSkillCalled, true);
  assert.deepEqual(outputs, [{
    updated: false,
    reason: "already up to date",
    localCommit: "local",
    remoteCommit: "remote",
    installSpec: "git+https://example.invalid/sea-agent-cli.git",
    skill: {
      updated: true,
      skill: "seaagent-cli",
      version: "2026.08.14",
      path: "/local/seaagent-cli",
      hash: "local-hash",
    },
  }]);
});

test("self update runs the CLI update before refreshing the bundled skill", async () => {
  const calls: string[] = [];
  const outputs: unknown[] = [];
  const command = selfCommand({
    getCliUpdateStatus: async () => ({
      name: "@seaart/sea-agent-cli",
      currentVersion: "0.1.0",
      localCommit: "local",
      remoteCommit: "remote",
      remoteURL: "https://example.invalid/remote",
      githubRepo: "SeaArt-Infra/sea-agent-cli",
      githubBranch: "sync-github-main",
      installSpec: "git+https://example.invalid/sea-agent-cli.git",
      cachePath: "/cache/cli-update.json",
      checkedAt: "2026-08-14T00:00:00.000Z",
      status: "update-available",
      updateAvailable: true,
    }),
    updateCliPackage: async () => {
      calls.push("cli");
      return {
        updated: true,
        installSpec: "git+https://example.invalid/sea-agent-cli.git",
        command: "npm install -g package.tgz",
      };
    },
    updateLocalSkill: async () => {
      calls.push("skill");
      return skillStatus;
    },
    printJSON: (value) => outputs.push(value),
  });

  await runUpdate(command);

  assert.deepEqual(calls, ["cli", "skill"]);
  assert.deepEqual(outputs, [{
    updated: true,
    installSpec: "git+https://example.invalid/sea-agent-cli.git",
    command: "npm install -g package.tgz",
    skill: {
      updated: true,
      skill: "seaagent-cli",
      version: "2026.08.14",
      path: "/local/seaagent-cli",
      hash: "local-hash",
    },
  }]);
});
