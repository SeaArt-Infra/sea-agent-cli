import assert from "node:assert/strict";
import test from "node:test";
import { updatePayloadWithReasoningEffort } from "./agent-update-payload.js";

const agentResponse = {
  data: {
    category: "fabric",
    name: "creative_assistant",
    owner_id: "internal",
    status: "active",
    model_config: { default: "gpt-5.5", allowed: ["gpt-5.5"], reasoning_effort: "low" },
    system_prompt: "Keep answers concise.",
    agent_config: { temperature: 0.2, max_turns: 8 },
    skills: ["skill-1"],
    pre_skills: ["skill-1"],
  },
};

test("updatePayloadWithReasoningEffort preserves the current Agent configuration", () => {
  const payload = updatePayloadWithReasoningEffort(agentResponse, " HIGH ");

  assert.deepEqual(payload, {
    category: "fabric",
    name: "creative_assistant",
    owner_id: "internal",
    status: "active",
    metadata: {},
    model_config: { default: "gpt-5.5", allowed: ["gpt-5.5"], reasoning_effort: "high" },
    system_prompt: "Keep answers concise.",
    agent_config: { temperature: 0.2, max_turns: 8 },
    skills: ["skill-1"],
    pre_skills: ["skill-1"],
  });
});

test("updatePayloadWithReasoningEffort rejects unsupported values", () => {
  assert.throws(() => updatePayloadWithReasoningEffort(agentResponse, "maximum"), /reasoning-effort/);
});

test("updatePayloadWithReasoningEffort restores empty Gateway skill bindings as arrays", () => {
  const response = {
    data: {
      ...agentResponse.data,
      skills: null,
      pre_skills: null,
    },
  };

  const payload = updatePayloadWithReasoningEffort(response, "medium");

  assert.deepEqual(payload.skills, []);
  assert.deepEqual(payload.pre_skills, []);
});
