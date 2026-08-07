import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chatPayloadFromCommand } from "./chat.js";

test("chatPayloadFromCommand sends the temporary reasoning effort", async () => {
  const payload = await chatPayloadFromCommand(
    "agent-1",
    ["hello"],
    {
      model: "gpt-5.5",
      reasoningEffort: " HIGH ",
      stream: true,
      streamRetries: "-1",
      retryDelayMs: "1000",
    },
  );

  assert.deepEqual(payload, {
    agent_id: "agent-1",
    model: "gpt-5.5",
    reasoning_effort: "high",
    messages: [{ role: "user", content: "hello" }],
    stream: true,
  });
});

test("chatPayloadFromCommand rejects an unsupported temporary reasoning effort", async () => {
  await assert.rejects(
    chatPayloadFromCommand(
      "agent-1",
      ["hello"],
      {
        reasoningEffort: "maximum",
        stream: true,
        streamRetries: "-1",
        retryDelayMs: "1000",
      },
    ),
    /reasoning-effort/,
  );
});

test("chatPayloadFromCommand lets the command-line reasoning effort override a payload file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "seaagent-chat-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const payloadPath = join(directory, "chat.json");
  await writeFile(payloadPath, JSON.stringify({
    agent_id: "agent-from-file",
    reasoning_effort: "low",
    messages: [{ role: "user", content: "hello" }],
  }));

  const payload = await chatPayloadFromCommand(
    "agent-from-command",
    undefined,
    {
      messagesFile: payloadPath,
      reasoningEffort: "medium",
      stream: true,
      streamRetries: "-1",
      retryDelayMs: "1000",
    },
  );

  assert.equal(payload.agent_id, "agent-from-command");
  assert.equal(payload.reasoning_effort, "medium");
});
