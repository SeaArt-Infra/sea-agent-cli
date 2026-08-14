import { Command } from "commander";
import { getCliUpdateStatus, updateCliPackage } from "../lib/cli-update.js";
import { addHelpText } from "../lib/help.js";
import { printJSON } from "../lib/output.js";
import { getSkillUpdateStatus, updateLocalSkill } from "../lib/self-update.js";

type SelfCommandDependencies = {
  getCliUpdateStatus?: typeof getCliUpdateStatus;
  updateCliPackage?: typeof updateCliPackage;
  getSkillUpdateStatus?: typeof getSkillUpdateStatus;
  updateLocalSkill?: typeof updateLocalSkill;
  printJSON?: typeof printJSON;
};

export function selfCommand(dependencies: SelfCommandDependencies = {}): Command {
  const checkCliUpdate = dependencies.getCliUpdateStatus ?? getCliUpdateStatus;
  const updateCli = dependencies.updateCliPackage ?? updateCliPackage;
  const checkSkillUpdate = dependencies.getSkillUpdateStatus ?? getSkillUpdateStatus;
  const updateSkill = dependencies.updateLocalSkill ?? updateLocalSkill;
  const print = dependencies.printJSON ?? printJSON;
  const cmd = addHelpText(new Command("self").description("Check and update local CLI package and support files"), `
Self commands check this installed CLI package and bundled local support files.
Automatic CLI update checks run at most daily and only print update notices to stderr.
Automatic skill checks run at most every 2 hours and only print update notices to stderr.
\`self update\` updates the CLI package and then refreshes the bundled Codex skill.

Examples:
  seaagent self check-update
  seaagent self update
  seaagent self check
  seaagent self update-skill
`);

  cmd
    .command("check-update")
    .description("Check whether a newer seaagent CLI is available on GitHub")
    .action(async () => {
      print(await checkCliUpdate());
    });

  cmd
    .command("update")
    .description("Update this CLI from GitHub and refresh the bundled Codex skill")
    .action(async () => {
      const status = await checkCliUpdate();
      if (status.status === "up-to-date") {
        const skill = await updateSkill();
        print({
          updated: false,
          reason: "already up to date",
          localCommit: status.localCommit,
          remoteCommit: status.remoteCommit,
          installSpec: status.installSpec,
          skill: skillUpdateResult(skill),
        });
        return;
      }
      process.stderr.write(`Running verified update from ${status.installSpec}\n`);
      const cli = await updateCli();
      const skill = await updateSkill();
      print({ ...cli, skill: skillUpdateResult(skill) });
    });

  cmd
    .command("check")
    .description("Check local seaagent-cli skill freshness")
    .action(async () => {
      print(await checkSkillUpdate());
    });

  cmd
    .command("update-skill")
    .description("Install bundled seaagent-cli skill into ~/.codex/skills")
    .action(async () => {
      print(skillUpdateResult(await updateSkill()));
    });

  return cmd;
}

function skillUpdateResult(status: Awaited<ReturnType<typeof updateLocalSkill>>) {
  return {
    updated: status.upToDate,
    skill: status.skill,
    version: status.bundledVersion,
    path: status.localPath,
    hash: status.localHash,
  };
}
