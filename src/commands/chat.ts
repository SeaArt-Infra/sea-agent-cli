import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { readPayload } from "../lib/files.js";
import { printJSON } from "../lib/output.js";

export function chatCommand(): Command {
  const cmd = new Command("chat").description("Run and manage chats");

  cmd
    .command("run")
    .argument("[agent-id]")
    .argument("[message...]")
    .option("-f, --agent-config-file <path>", "JSON/YAML runtime agent_config file")
    .option("--no-stream", "disable streaming")
    .action(async (agentID: string | undefined, messageParts: string[] | undefined, options: { agentConfigFile?: string; stream: boolean }) => {
      const client = await AgentGatewayClient.fromConfig();
      if (!agentID && !options.agentConfigFile) {
        throw new Error("agent-id or --agent-config-file is required");
      }
      const payload = {
        ...(agentID ? { agent_id: agentID } : {}),
        ...(options.agentConfigFile ? { agent_config: await readPayload(options.agentConfigFile) } : {}),
        messages: [{ role: "user", content: (messageParts ?? []).join(" ") }],
        stream: options.stream,
      };
      printJSON(await client.post("/v1/chat/completions", payload));
    });

  cmd.command("get").argument("<chat-id>").action(async (chatID: string) => {
    const client = await AgentGatewayClient.fromConfig();
    printJSON(await client.get(`/v1/chats/${encodeURIComponent(chatID)}`));
  });

  cmd.command("events").argument("<chat-id>").option("--after-seq <number>", "after sequence", "0").option("--limit <number>", "limit", "100").action(async (chatID: string, options) => {
    const client = await AgentGatewayClient.fromConfig();
    printJSON(await client.get(`/v1/chats/${encodeURIComponent(chatID)}/events`, {
      after_seq: options.afterSeq,
      limit: options.limit,
    }));
  });

  cmd.command("cancel").argument("<chat-id>").action(async (chatID: string) => {
    const client = await AgentGatewayClient.fromConfig();
    printJSON(await client.post(`/v1/chats/${encodeURIComponent(chatID)}/cancel`));
  });

  return cmd;
}
