import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { readPayload } from "../lib/files.js";
import { printJSON, printTable } from "../lib/output.js";

export function skillCommand(): Command {
  const cmd = new Command("skill").description("Register and inspect skills");

  cmd
    .command("register")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.post("/v1/skills/register", await readPayload(options.file)));
    });

  cmd
    .command("tool-register")
    .description("Register a Tool used by a Skill")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.post("/v1/tools/register", await readPayload(options.file)));
    });

  cmd
    .command("list")
    .option("--search <value>")
    .option("--status <value>")
    .option("--provider <value>")
    .option("--category <value>")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .action(async (options) => {
      const client = await AgentGatewayClient.fromConfig();
      const response = await client.get("/v1/catalog", {
        capability_type: "skill",
        search: options.search,
        status: options.status,
        provider: options.provider,
        category: options.category,
        limit: options.limit,
        offset: options.offset,
      });
      printTable((response as any).data?.items ?? (response as any).data ?? response);
    });

  return cmd;
}
