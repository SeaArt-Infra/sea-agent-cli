const reasoningEffortValues = ["off", "on", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"] as const;

export type ReasoningEffort = (typeof reasoningEffortValues)[number];

export type AgentUpdatePayload = {
  category: string;
  name: string;
  owner_id: string;
  status: string;
  metadata: Record<string, never>;
  model_config: Record<string, unknown>;
  system_prompt: string;
  agent_config: Record<string, unknown>;
  skills: string[];
  pre_skills: string[];
};

export function updatePayloadWithReasoningEffort(response: unknown, effort: string): AgentUpdatePayload {
  return updatePayloadWithRuntimeOverrides(response, { reasoningEffort: effort });
}

export function updatePayloadWithMaxOutputTokens(response: unknown, maxOutputTokens: string): AgentUpdatePayload {
  return updatePayloadWithRuntimeOverrides(response, { maxOutputTokens });
}

export function updatePayloadWithRuntimeOverrides(
  response: unknown,
  overrides: { reasoningEffort?: string; maxOutputTokens?: string },
): AgentUpdatePayload {
  const agent = agentFromResponse(response);
  const modelConfig = copyObject(agent.model_config, "model_config");
  const agentConfig = copyObject(agent.agent_config, "agent_config");
  if (overrides.reasoningEffort !== undefined) {
    modelConfig.reasoning_effort = normalizeReasoningEffort(overrides.reasoningEffort);
  }
  if (overrides.maxOutputTokens !== undefined) {
    agentConfig.max_output_tokens = normalizeMaxOutputTokens(overrides.maxOutputTokens);
  }

  return {
    category: requiredString(agent, "category"),
    name: requiredString(agent, "name"),
    owner_id: requiredString(agent, "owner_id"),
    status: requiredString(agent, "status"),
    metadata: {},
    model_config: modelConfig,
    system_prompt: requiredString(agent, "system_prompt", true),
    agent_config: agentConfig,
    skills: copyStringArray(agent.skills, "skills"),
    pre_skills: copyStringArray(agent.pre_skills, "pre_skills"),
  };
}

export function reasoningEffortHelp(): string {
  return reasoningEffortValues.join(", ");
}

export function normalizeMaxOutputTokens(value: string): number {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("--max-output-tokens must be a positive integer");
  }
  return parsed;
}

function agentFromResponse(response: unknown): Record<string, unknown> {
  const envelope = asObject(response, "agent response");
  return "data" in envelope ? asObject(envelope.data, "agent response data") : envelope;
}

export function normalizeReasoningEffort(value: string): ReasoningEffort {
  const normalized = value.trim().toLowerCase();
  if ((reasoningEffortValues as readonly string[]).includes(normalized)) {
    return normalized as ReasoningEffort;
  }
  throw new Error(`--reasoning-effort must be one of: ${reasoningEffortHelp()}`);
}

function requiredString(record: Record<string, unknown>, field: string, allowEmpty = false): string {
  const value = record[field];
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw new Error(`agent response is missing ${field}; use seaagent agent get to inspect the agent before updating it`);
  }
  return value;
}

function copyObject(value: unknown, field: string): Record<string, unknown> {
  return { ...asObject(value, `agent response ${field}`) };
}

function copyStringArray(value: unknown, field: string): string[] {
  // Gateway 会把空 Go slice 序列化成 null；更新请求中需还原为 []。
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`agent response ${field} must be a string array; use seaagent agent get to inspect the agent before updating it`);
  }
  return [...value];
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object; use seaagent agent get to inspect the agent before updating it`);
  }
  return value as Record<string, unknown>;
}
