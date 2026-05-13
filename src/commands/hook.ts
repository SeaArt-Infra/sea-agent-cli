import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { readPayload } from "../lib/files.js";
import { printJSON, printTable } from "../lib/output.js";

export function hookCommand(): Command {
  const cmd = new Command("hook").description("Register and manage Agent Worker hooks for the configured API key");

  cmd
    .command("register")
    .description("Register or update the hook for the configured API key")
    .requiredOption("-f, --file <path>", "JSON/YAML hook payload file")
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.post("/v1/hooks/register", await readPayload(options.file)));
    });

  cmd
    .command("list")
    .description("List hooks for the configured API key")
    .option("--search <value>")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .action(async (options) => {
      const client = await AgentGatewayClient.fromConfig();
      const response = await client.get("/v1/hooks", {
        search: options.search,
        limit: options.limit,
        offset: options.offset,
      });
      printTable((response as any).data ?? response);
    });

  cmd
    .command("get")
    .description("Get a hook owned by the configured API key")
    .argument("<hook-id>")
    .action(async (hookID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.get(`/v1/hooks/${encodeURIComponent(hookID)}`));
    });

  cmd
    .command("update")
    .description("Update a hook owned by the configured API key")
    .argument("<hook-id>")
    .requiredOption("-f, --file <path>", "JSON/YAML hook payload file")
    .action(async (hookID: string, options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.put(`/v1/hooks/${encodeURIComponent(hookID)}`, await readPayload(options.file)));
    });

  cmd
    .command("delete")
    .description("Delete a hook owned by the configured API key")
    .argument("<hook-id>")
    .action(async (hookID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.delete(`/v1/hooks/${encodeURIComponent(hookID)}`));
    });

  return cmd;
}
