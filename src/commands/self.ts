import { Command } from "commander";
import { addHelpText } from "../lib/help.js";
import { printJSON } from "../lib/output.js";
import { getSkillUpdateStatus, updateLocalSkill } from "../lib/self-update.js";

export function selfCommand(): Command {
  const cmd = addHelpText(new Command("self").description("Check and update local CLI support files"), `
Self commands compare this installed CLI package with local support files.
Automatic checks run at most every 2 hours and only print update notices to stderr.

Examples:
  seaagent self check
  seaagent self update-skill
`);

  cmd
    .command("check")
    .description("Check local seaagent-cli skill freshness")
    .action(async () => {
      printJSON(await getSkillUpdateStatus());
    });

  cmd
    .command("update-skill")
    .description("Install bundled seaagent-cli skill into ~/.codex/skills")
    .action(async () => {
      const status = await updateLocalSkill();
      printJSON({
        updated: status.upToDate,
        skill: status.skill,
        version: status.bundledVersion,
        path: status.localPath,
        hash: status.localHash,
      });
    });

  return cmd;
}
