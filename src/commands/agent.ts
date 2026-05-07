import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { readPayload } from "../lib/files.js";
import { printJSON, printTable } from "../lib/output.js";

export function agentCommand(): Command {
  const cmd = new Command("agent").description("Register and inspect agents");

  cmd
    .command("register")
    .description("Register an agent via /v1/agents/register")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.post("/v1/agents/register", await readPayload(options.file)));
    });

  cmd
    .command("create")
    .description("Create an agent via /v1/agents")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.post("/v1/agents", await readPayload(options.file)));
    });

  cmd
    .command("list")
    .option("--search <value>")
    .option("--status <value>")
    .option("--owner-id <value>")
    .option("--category <value>")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .action(async (options) => {
      const client = await AgentGatewayClient.fromConfig();
      const response = await client.get("/v1/agents", {
        search: options.search,
        status: options.status,
        owner_id: options.ownerId,
        category: options.category,
        limit: options.limit,
        offset: options.offset,
      });
      printTable((response as any).data ?? response);
    });

  cmd
    .command("capabilities")
    .argument("<agent-id>")
    .action(async (agentID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.get(`/v1/agents/${encodeURIComponent(agentID)}/capabilities`));
    });

  return cmd;
}
