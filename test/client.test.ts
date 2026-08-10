import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { AgentGatewayClient } from "../src/lib/client.js";

test("chat requests send the agent id in header and body", async () => {
  let receivedHeaders: Record<string, string | string[] | undefined> = {};
  let receivedBody = "";
  const server = createServer((request, response) => {
    receivedHeaders = request.headers;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      receivedBody += chunk;
    });
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      response.end("{}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const client = new AgentGatewayClient(`http://127.0.0.1:${address.port}`);
    await client.post("/v1/chat/completions", { agent_id: "agent_1", messages: [] });

    assert.equal(receivedHeaders["x-agent-id"], "agent_1");
    assert.equal(JSON.parse(receivedBody).agent_id, "agent_1");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
