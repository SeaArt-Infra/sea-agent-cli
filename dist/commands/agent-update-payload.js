const reasoningEffortValues = ["off", "on", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
export function updatePayloadWithReasoningEffort(response, effort) {
    const agent = agentFromResponse(response);
    const modelConfig = copyObject(agent.model_config, "model_config");
    modelConfig.reasoning_effort = normalizeReasoningEffort(effort);
    return {
        category: requiredString(agent, "category"),
        name: requiredString(agent, "name"),
        owner_id: requiredString(agent, "owner_id"),
        status: requiredString(agent, "status"),
        metadata: {},
        model_config: modelConfig,
        system_prompt: requiredString(agent, "system_prompt", true),
        agent_config: copyObject(agent.agent_config, "agent_config"),
        skills: copyStringArray(agent.skills, "skills"),
        pre_skills: copyStringArray(agent.pre_skills, "pre_skills"),
    };
}
export function reasoningEffortHelp() {
    return reasoningEffortValues.join(", ");
}
function agentFromResponse(response) {
    const envelope = asObject(response, "agent response");
    return "data" in envelope ? asObject(envelope.data, "agent response data") : envelope;
}
function normalizeReasoningEffort(value) {
    const normalized = value.trim().toLowerCase();
    if (reasoningEffortValues.includes(normalized)) {
        return normalized;
    }
    throw new Error(`--reasoning-effort must be one of: ${reasoningEffortHelp()}`);
}
function requiredString(record, field, allowEmpty = false) {
    const value = record[field];
    if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
        throw new Error(`agent response is missing ${field}; use seaagent agent get to inspect the agent before updating it`);
    }
    return value;
}
function copyObject(value, field) {
    return { ...asObject(value, `agent response ${field}`) };
}
function copyStringArray(value, field) {
    // Gateway 会把空 Go slice 序列化成 null；更新请求中需还原为 []。
    if (value == null) {
        return [];
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        throw new Error(`agent response ${field} must be a string array; use seaagent agent get to inspect the agent before updating it`);
    }
    return [...value];
}
function asObject(value, field) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${field} must be an object; use seaagent agent get to inspect the agent before updating it`);
    }
    return value;
}
