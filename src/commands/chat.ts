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
    .option("--ws", "use WebSocket streaming")
    .action(async (agentID: string | undefined, messageParts: string[] | undefined, options: { agentConfigFile?: string; stream: boolean; ws?: boolean }) => {
      const client = await AgentGatewayClient.fromConfig();
      if (!agentID && !options.agentConfigFile) {
        throw new Error("agent-id or --agent-config-file is required");
      }
      if (!options.stream && options.ws) {
        throw new Error("--ws cannot be used with --no-stream");
      }
      const payload = {
        ...(agentID ? { agent_id: agentID } : {}),
        ...(options.agentConfigFile ? { agent_config: await readPayload(options.agentConfigFile) } : {}),
        messages: [{ role: "user", content: (messageParts ?? []).join(" ") }],
        stream: options.stream,
      };
      if (options.stream) {
        const renderer = createChatStreamRenderer();
        if (options.ws) {
          await client.websocket("/v1/chat/completions/ws", undefined, payload, renderer.writeWebSocketMessage);
        } else {
          await client.postStream("/v1/chat/completions", payload, renderer.writeSSEChunk);
        }
        renderer.end();
        return;
      }
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

  cmd.command("stream").argument("<chat-id>").option("--after-seq <number>", "after sequence", "0").option("--ws", "use WebSocket streaming").action(async (chatID: string, options) => {
    const client = await AgentGatewayClient.fromConfig();
    const renderer = createChatStreamRenderer();
    if (options.ws) {
      await client.websocket(`/v1/chats/${encodeURIComponent(chatID)}/ws`, {
        after_seq: options.afterSeq,
      }, undefined, renderer.writeWebSocketMessage);
    } else {
      await client.getStream(`/v1/chats/${encodeURIComponent(chatID)}/stream`, {
        after_seq: options.afterSeq,
      }, renderer.writeSSEChunk);
    }
    renderer.end();
  });

  cmd.command("cancel").argument("<chat-id>").action(async (chatID: string) => {
    const client = await AgentGatewayClient.fromConfig();
    printJSON(await client.post(`/v1/chats/${encodeURIComponent(chatID)}/cancel`));
  });

  return cmd;
}

function createChatStreamRenderer(): { writeSSEChunk: (chunk: string) => void; writeWebSocketMessage: (message: string) => void; end: () => void } {
  let buffer = "";
  let wroteText = false;
  return {
    writeSSEChunk(chunk: string): void {
      buffer += chunk;
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (renderChatStreamBlock(part)) {
          wroteText = true;
        }
      }
    },
    writeWebSocketMessage(message: string): void {
      if (renderChatStreamEvent(parseWebSocketEvent(message))) {
        wroteText = true;
      }
    },
    end(): void {
      if (buffer.trim() && renderChatStreamBlock(buffer)) {
        wroteText = true;
      }
      if (wroteText) {
        process.stdout.write("\n");
      }
    },
  };
}

function renderChatStreamBlock(block: string): boolean {
  let wroteText = false;
  for (const event of parseSSE(block)) {
    wroteText = renderChatStreamEvent(event) || wroteText;
  }
  return wroteText;
}

function renderChatStreamEvent(event: ChatStreamEvent): boolean {
  const chunk = textFromStreamEvent(event);
  if (!chunk) {
    return false;
  }
  process.stdout.write(chunk);
  return true;
}

type ChatStreamEvent = {
  event: string;
  data: unknown;
};

function parseSSE(text: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  for (const block of text.split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }
    if (dataLines.length === 0) {
      continue;
    }
    const dataText = dataLines.join("\n");
    let data: unknown = dataText;
    try {
      data = JSON.parse(dataText);
    } catch {
      // Keep non-JSON data as raw text.
    }
    events.push({ event, data });
  }
  return events;
}

function parseWebSocketEvent(message: string): ChatStreamEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch {
    return { event: "message", data: message };
  }
  if (!parsed || typeof parsed !== "object") {
    return { event: "message", data: parsed };
  }
  const object = parsed as Record<string, unknown>;
  const event = typeof object.event === "string" && object.event ? object.event : "message";
  if (event === "error") {
    const code = typeof object.code === "string" && object.code ? `${object.code}: ` : "";
    const messageText = typeof object.error === "string" ? object.error : JSON.stringify(object);
    throw new Error(`${code}${messageText}`);
  }
  return { event, data: object.data };
}

function textFromStreamEvent(event: ChatStreamEvent): string {
  if (event.event === "response.text.delta" || event.event === "response.output_text.delta") {
    return stringField(event.data, "delta");
  }
  if (event.event === "chat.response" || event.event === "message.delta") {
    return stringField(event.data, "content") || stringField(event.data, "text") || stringField(event.data, "delta");
  }
  return "";
}

function stringField(data: unknown, field: string): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}
