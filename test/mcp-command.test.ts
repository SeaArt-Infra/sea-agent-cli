import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { mcpCommand } from "../src/commands/mcp.js";
import { AgentGatewayClient } from "../src/lib/client.js";

type RecordedRequest = {
  method: string;
  path: string;
  query: string;
  body: unknown;
};

test("MCP commands use management routes and preserve payload files", async (t) => {
  const requests: RecordedRequest[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    requests.push({
      method: request.method ?? "",
      path: request.url?.split("?")[0] ?? "",
      query: request.url?.split("?")[1] ?? "",
      body: rawBody ? JSON.parse(rawBody) : undefined,
    });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ data: {} }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not expose a TCP port");
  }
  const client = new AgentGatewayClient(`http://127.0.0.1:${address.port}`);
  const payloadDirectory = await mkdtemp(join(tmpdir(), "seaagent-mcp-test-"));
  t.after(() => rm(payloadDirectory, { recursive: true, force: true }));
  const serverPayload = {
    name: "private-search",
    server_url: "https://mcp.example.com/mcp",
    transport: "streamable-http",
    public: false,
  };
  const callPayload = { name: "search", arguments: { query: "hello" } };
  const serverPayloadPath = join(payloadDirectory, "mcp.json");
  const callPayloadPath = join(payloadDirectory, "call.json");
  await writeFile(serverPayloadPath, JSON.stringify(serverPayload));
  await writeFile(callPayloadPath, JSON.stringify(callPayload));

  const confirmations: string[] = [];
  const command = () => mcpCommand({
    createClient: async () => client,
    confirmMutation: async ({ action }) => {
      confirmations.push(action);
    },
  });

  await run(command(), ["register", "--file", serverPayloadPath]);
  await run(command(), ["list", "--search", "search", "--status", "active", "--public", "false", "--provider", "line-a", "--include-deleted", "--limit", "5", "--offset", "2"]);
  await run(command(), ["get", "mcp/1"]);
  await run(command(), ["update", "mcp-1", "--file", serverPayloadPath]);
  await run(command(), ["delete", "mcp-1"]);
  await run(command(), ["tools", "mcp-1"]);
  await run(command(), ["call", "mcp-1", "--file", callPayloadPath]);

  assert.deepEqual(requests, [
    { method: "POST", path: "/agent-v2/v1/mcps/register", query: "", body: serverPayload },
    { method: "GET", path: "/agent-v2/v1/mcps", query: "search=search&status=active&public=false&provider=line-a&include_deleted=true&limit=5&offset=2", body: undefined },
    { method: "GET", path: "/agent-v2/v1/mcps/mcp%2F1", query: "", body: undefined },
    { method: "PUT", path: "/agent-v2/v1/mcps/mcp-1", query: "", body: serverPayload },
    { method: "DELETE", path: "/agent-v2/v1/mcps/mcp-1", query: "", body: undefined },
    { method: "GET", path: "/agent-v2/v1/mcps/mcp-1/tools", query: "", body: undefined },
    { method: "POST", path: "/agent-v2/v1/mcps/mcp-1/call", query: "", body: callPayload },
  ]);
  assert.deepEqual(confirmations, ["register", "update", "delete", "call"]);
});

async function run(command: ReturnType<typeof mcpCommand>, args: string[]): Promise<void> {
  command.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
  command.exitOverride();
  await command.parseAsync(["node", "seaagent", ...args]);
}
