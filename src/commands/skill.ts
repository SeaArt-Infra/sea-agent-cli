import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { confirmRegistryMutation } from "../lib/confirmation.js";
import { readPayload } from "../lib/files.js";
import { addHelpText, commonListHelp, payloadFileHelp } from "../lib/help.js";
import { printJSON, printTable } from "../lib/output.js";

export function skillCommand(): Command {
  const cmd = addHelpText(new Command("skill").description("Register and inspect skills"), `
Skills are agent-facing instructions plus tool bindings.
Use immutable skill UUIDs returned by the gateway for get/update/delete.

${commonListHelp}

${payloadFileHelp}

Examples:
  seaagent skill list --status active
  seaagent skill register -f examples/skill-web.json
  seaagent skill get <skill-id>
`);

  cmd
    .command("register")
    .description("Register a skill via /v1/skills/register")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Examples:
  seaagent skill register -f examples/skill-web.json
  seaagent skill register --file payloads/skill.yaml

Prefer UUID tool refs for registered tools. Use 'seaagent tool resolve <tool-id>'
when you need to inspect runtime metadata before binding.`)
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
        action: "register",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "skill",
      });
      printJSON(await client.post("/v1/skills/register", payload));
    });

  cmd
    .command("tool-register")
    .description("Register a Tool used by a Skill")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Example:
  seaagent skill tool-register -f examples/tool-web-fetch.json

This is a convenience alias for 'seaagent tool register'.`)
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
        action: "register",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "tool",
      });
      printJSON(await client.post("/v1/tools/register", payload));
    });

  cmd
    .command("list")
    .description("List skills")
    .option("--search <value>", "search text")
    .option("--status <value>", "draft, active, deprecated, disabled, or deleted")
    .option("--public <true|false>", "filter by public visibility when supported")
    .option("--provider <value>", "provider namespace")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .addHelpText("after", `

Examples:
  seaagent skill list --status active
  seaagent skill list --search media --provider internal --limit 50`)
    .action(async (options) => {
      const client = await AgentGatewayClient.fromConfig();
      const response = await client.get("/v1/skills", {
        search: options.search,
        status: options.status,
        public: options.public,
        provider: options.provider,
        limit: options.limit,
        offset: options.offset,
      });
      printTable((response as any).data ?? response);
    });

  cmd.command("get").description("Get one skill by immutable UUID").argument("<skill-id>", "skill UUID").action(async (skillID: string) => {
    const client = await AgentGatewayClient.fromConfig();
    printJSON(await client.get(`/v1/skills/${encodeURIComponent(skillID)}`));
  });

  cmd
    .command("update")
    .description("Update a skill via /v1/skills/{skill-id}")
    .argument("<skill-id>", "skill UUID")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Example:
  seaagent skill update <skill-id> -f payloads/skill-update.json`)
    .action(async (skillID: string, options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
        action: "update",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "skill",
        resourceID: skillID,
      });
      printJSON(await client.put(`/v1/skills/${encodeURIComponent(skillID)}`, payload));
    });

  cmd
    .command("delete")
    .description("Delete a skill via /v1/skills/{skill-id}")
    .argument("<skill-id>", "skill UUID")
    .action(async (skillID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.delete(`/v1/skills/${encodeURIComponent(skillID)}`));
    });

  return cmd;
}
