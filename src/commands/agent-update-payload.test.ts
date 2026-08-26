import assert from "node:assert/strict";
import test from "node:test";
import { updatePayloadWithMaxOutputTokens, updatePayloadWithReasoningEffort, updatePayloadWithRuntimeOverrides } from "./agent-update-payload.js";

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

test("updatePayloadWithMaxOutputTokens preserves the current Agent configuration", () => {
  const payload = updatePayloadWithMaxOutputTokens(agentResponse, " 4096 ");

  assert.equal(payload.agent_config.max_output_tokens, 4096);
  assert.equal(payload.model_config.reasoning_effort, "low");
  assert.equal(payload.agent_config.max_turns, 8);
});

test("runtime overrides can update output tokens and reasoning effort together", () => {
  const payload = updatePayloadWithRuntimeOverrides(agentResponse, { reasoningEffort: "high", maxOutputTokens: "1024" });

  assert.equal(payload.model_config.reasoning_effort, "high");
  assert.equal(payload.agent_config.max_output_tokens, 1024);
});

test("updatePayloadWithMaxOutputTokens rejects non-positive or fractional values", () => {
  for (const value of ["0", "-1", "1.5", "invalid"]) {
    assert.throws(() => updatePayloadWithMaxOutputTokens(agentResponse, value), /max-output-tokens/);
  }
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
