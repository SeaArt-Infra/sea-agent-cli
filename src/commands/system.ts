import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";

export function systemCommand(): Command {
  const cmd = new Command("system").description("Inspect gateway health and metrics");

  cmd.command("health").description("GET /health").action(async () => {
    const client = await AgentGatewayClient.fromConfig();
    console.log(await client.getText("/health"));
  });

  cmd.command("metrics").description("GET /metrics").action(async () => {
    const client = await AgentGatewayClient.fromConfig();
    console.log(await client.getText("/metrics"));
  });

  return cmd;
}
