import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { confirmRegistryMutation } from "../lib/confirmation.js";
import { readPayload } from "../lib/files.js";
import { addHelpText, payloadFileHelp } from "../lib/help.js";
import { printJSON, printTable } from "../lib/output.js";
import { withRegisterErrorHint } from "../lib/registry-hints.js";
export function agentCommand() {
    const cmd = addHelpText(new Command("agent").description("Register and inspect agents"), `
Agents bind skills and runtime configuration into runnable gateway resources.
Use immutable agent UUIDs returned by the gateway for update/capabilities/chat.

Agent categories:
  fabric    Normal Fabric scheduler pool
  seaactor  SeaActor scheduler pool

Common list filters:
  --search <value>      Match agent names and metadata
  --status <value>      draft | active | deprecated | disabled | deleted
  --owner-id <value>    Owner/production-line ID
  --category <value>    fabric | seaactor
  --limit <number>      Page size
  --offset <number>     Page offset

${payloadFileHelp}

Examples:
  seaagent agent list --status active
  seaagent agent register -f examples/agent-web.json
  seaagent agent get <agent-id>
  seaagent agent delete <agent-id>
  seaagent agent capabilities <agent-id>
  seaagent agent memory list <agent-id> --end-user-id <user-id>
  seaagent agent memory account delete <agent-id> --end-user-id <user-id>
  seaagent agent memory facts list <agent-id> --end-user-id <user-id>
  seaagent chat run <agent-id> "hello"
`);
    cmd
        .command("register")
        .description("Register an agent via /v1/agents/register")
        .requiredOption("-f, --file <path>", "JSON/YAML request file")
        .addHelpText("after", `

Examples:
  seaagent agent register -f examples/agent-web.json
  seaagent agent register -f examples/agent-sandbox.json

Payload notes:
  - category is required by current gateway deployments: fabric or seaactor.
  - Do not send agent_key for new registrations; gateway returns an immutable UUID.
  - skills is the complete Skill UUID array. Add only high-probability, decision-critical Skill UUIDs to pre_skills.
  - pre_skills must be a subset of skills. Gateway preloads those instructions into the Agent prompt and avoids their Worker SKILL.md reads, but adds prompt tokens on every run. Keep conditional, occasional, long, or uncertain Skills out of pre_skills.
  - Runtime settings belong in config/agent_config.

Minimal payload:
  {
    "name": "weather_assistant",
    "category": "fabric",
    "model": {"default": "claude-sonnet-4-6-seawork"},
    "system_prompt": "You are a concise assistant.",
    "skills": ["<always-needed-skill-uuid>", "<on-demand-skill-uuid>"],
    "pre_skills": ["<always-needed-skill-uuid>"],
    "config": {"temperature": 0.2},
    "enabled": true
  }`)
        .action(async (options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = await readPayload(options.file);
        await confirmRegistryMutation({
            action: "register",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "agent",
        });
        printJSON(await withRegisterErrorHint("agent", "examples/agent-web.json", () => client.postRegistry("/v1/agents/register", payload)));
    });
    cmd
        .command("update")
        .description("Update an agent via /v1/agents/{agent-id}")
        .argument("<agent-id>", "agent UUID")
        .requiredOption("-f, --file <path>", "JSON/YAML request file")
        .addHelpText("after", `

Example:
  seaagent agent update <agent-id> -f payloads/agent-update.json`)
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = await readPayload(options.file);
        await confirmRegistryMutation({
            action: "update",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "agent",
            resourceID: agentID,
        });
        printJSON(await client.putRegistry(`/v1/agents/${encodeURIComponent(agentID)}`, payload));
    });
    cmd
        .command("delete")
        .description("Delete an agent via /v1/agents/{agent-id}")
        .argument("<agent-id>", "agent UUID")
        .addHelpText("after", `

Example:
  seaagent agent delete <agent-id>

Delete uses the configured user-id as X-User-ID. The gateway only allows the
agent owner to delete the agent.`)
        .action(async (agentID) => {
        const client = await AgentGatewayClient.fromConfig();
        await confirmRegistryMutation({
            action: "delete",
            endpoint: client.getEndpoint(),
            resource: "agent",
            resourceID: agentID,
        });
        printJSON(await client.deleteRegistry(`/v1/agents/${encodeURIComponent(agentID)}`));
    });
    cmd
        .command("list")
        .description("List agents")
        .option("--search <value>", "search text")
        .option("--status <value>", "draft, active, deprecated, disabled, or deleted")
        .option("--owner-id <value>", "owner ID")
        .option("--category <fabric|seaactor>", "scheduler category")
        .option("--limit <number>", "page size", "20")
        .option("--offset <number>", "page offset", "0")
        .addHelpText("after", `

Examples:
  seaagent agent list --status active
  seaagent agent list --owner-id production-line-123
  seaagent agent list --category fabric --search web --limit 50`)
        .action(async (options) => {
        const client = await AgentGatewayClient.fromConfig();
        const response = await client.get("/v1/agents", {
            search: options.search,
            status: options.status,
            owner_id: options.ownerId,
            category: options.category,
            limit: options.limit,
            offset: options.offset,
        });
        printTable(response.data ?? response);
    });
    cmd
        .command("get")
        .description("Get one agent by immutable UUID")
        .argument("<agent-id>", "agent UUID")
        .action(async (agentID) => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.get(`/v1/agents/${encodeURIComponent(agentID)}`));
    });
    cmd
        .command("capabilities")
        .description("Show resolved skills and tools available to an agent")
        .argument("<agent-id>", "agent UUID")
        .addHelpText("after", `

Run this after agent or skill changes to verify what the worker will see.

Example:
  seaagent agent capabilities <agent-id>`)
        .action(async (agentID) => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.get(`/v1/agents/${encodeURIComponent(agentID)}/capabilities`));
    });
    cmd.addCommand(agentMemoryCommand());
    return cmd;
}
function agentMemoryCommand() {
    const memory = new Command("memory").description("Manage one terminal user's medium- and long-term memory");
    addMemoryEndUserOption(memory
        .command("list")
        .description("List medium-term memory")
        .argument("<agent-id>", "agent UUID")
        .option("--limit <number>", "page size", "20")
        .option("--offset <number>", "page offset", "0"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const response = await client.get(`/v1/agents/${encodeURIComponent(agentID)}/memory/`, {
            end_user_id: options.endUserId,
            limit: options.limit,
            offset: options.offset,
        });
        printTable(response.data?.items ?? response.items ?? response);
    });
    addMemoryEndUserOption(memory
        .command("export")
        .description("Export medium- and long-term memory")
        .argument("<agent-id>", "agent UUID"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.get(`/v1/agents/${encodeURIComponent(agentID)}/memory/export`, {
            end_user_id: options.endUserId,
        }));
    });
    addMemoryEndUserOption(memory
        .command("candidates")
        .description("List cross-session preference candidates awaiting user confirmation")
        .argument("<agent-id>", "agent UUID")
        .option("--limit <number>", "page size", "20")
        .option("--offset <number>", "page offset", "0"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const response = await client.get(`/v1/agents/${encodeURIComponent(agentID)}/memory/candidates`, {
            end_user_id: options.endUserId,
            limit: options.limit,
            offset: options.offset,
        });
        printTable(response.data?.items ?? response.items ?? response);
    });
    addMemoryEndUserOption(memory
        .command("confirm")
        .description("Confirm a preference candidate as a long-term fact")
        .argument("<agent-id>", "agent UUID")
        .argument("<candidate-id>", "candidate ID")
        .requiredOption("-f, --file <path>", "JSON/YAML body containing fact_key and optional fact_value"))
        .action(async (agentID, candidateID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = withMemoryEndUser(await readPayload(options.file), options.endUserId);
        await confirmRegistryMutation({
            action: "register",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "memory candidate",
            resourceID: candidateID,
        });
        printJSON(await client.post(`/v1/agents/${encodeURIComponent(agentID)}/memory/candidates/${encodeURIComponent(candidateID)}/confirm`, payload));
    });
    addMemoryEndUserOption(memory
        .command("update")
        .description("Correct one medium-term memory item")
        .argument("<agent-id>", "agent UUID")
        .argument("<memory-id>", "memory ID")
        .requiredOption("-f, --file <path>", "JSON/YAML body containing content"))
        .action(async (agentID, memoryID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = withMemoryEndUser(await readPayload(options.file), options.endUserId);
        await confirmRegistryMutation({
            action: "update",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "memory",
            resourceID: memoryID,
        });
        printJSON(await client.put(`/v1/agents/${encodeURIComponent(agentID)}/memory/${encodeURIComponent(memoryID)}`, payload));
    });
    addMemoryEndUserOption(memory
        .command("delete")
        .description("Forget one medium-term memory item")
        .argument("<agent-id>", "agent UUID")
        .argument("<memory-id>", "memory ID")
        .option("--reason <value>", "deletion reason", "user_request"))
        .action(async (agentID, memoryID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = { reason: options.reason, end_user_id: options.endUserId };
        await confirmRegistryMutation({
            action: "delete",
            endpoint: client.getEndpoint(),
            payload,
            resource: "memory",
            resourceID: memoryID,
        });
        printJSON(await client.deleteWithBody(`/v1/agents/${encodeURIComponent(agentID)}/memory/${encodeURIComponent(memoryID)}`, payload));
    });
    const account = new Command("account").description("Delete all persisted memory for one terminal user");
    addMemoryEndUserOption(account
        .command("delete")
        .description("Permanently delete one terminal user's worker, medium-, and long-term memory")
        .argument("<agent-id>", "agent UUID")
        .option("--reason <value>", "deletion reason", "user_request"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = { reason: options.reason, end_user_id: options.endUserId };
        await confirmRegistryMutation({
            action: "delete",
            endpoint: client.getEndpoint(),
            payload,
            resource: "memory account",
            resourceID: `${agentID}:${options.endUserId}`,
        });
        printJSON(await client.deleteWithBody(`/v1/agents/${encodeURIComponent(agentID)}/memory/account`, payload));
    });
    memory.addCommand(account);
    const facts = new Command("facts").description("Manage confirmed long-term facts");
    addMemoryEndUserOption(facts
        .command("list")
        .description("List long-term facts")
        .argument("<agent-id>", "agent UUID")
        .option("--status <value>", "fact status", "active")
        .option("--limit <number>", "page size", "50")
        .option("--offset <number>", "page offset", "0"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const response = await client.get(`/v1/agents/${encodeURIComponent(agentID)}/memory/facts`, {
            end_user_id: options.endUserId,
            status: options.status,
            limit: options.limit,
            offset: options.offset,
        });
        printTable(response.data?.items ?? response.items ?? response);
    });
    addMemoryEndUserOption(facts
        .command("create")
        .description("Create or confirm a long-term fact")
        .argument("<agent-id>", "agent UUID")
        .requiredOption("-f, --file <path>", "JSON/YAML fact body"))
        .action(async (agentID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = withMemoryEndUser(await readPayload(options.file), options.endUserId);
        await confirmRegistryMutation({
            action: "register",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "fact",
        });
        printJSON(await client.post(`/v1/agents/${encodeURIComponent(agentID)}/memory/facts`, payload));
    });
    addMemoryEndUserOption(facts
        .command("update")
        .description("Correct a long-term fact by creating a new version")
        .argument("<agent-id>", "agent UUID")
        .argument("<fact-id>", "fact ID")
        .requiredOption("-f, --file <path>", "JSON/YAML correction body"))
        .action(async (agentID, factID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = withMemoryEndUser(await readPayload(options.file), options.endUserId);
        await confirmRegistryMutation({
            action: "update",
            endpoint: client.getEndpoint(),
            payload,
            payloadPath: options.file,
            resource: "fact",
            resourceID: factID,
        });
        printJSON(await client.put(`/v1/agents/${encodeURIComponent(agentID)}/memory/facts/${encodeURIComponent(factID)}`, payload));
    });
    addMemoryEndUserOption(facts
        .command("delete")
        .description("Forget a long-term fact")
        .argument("<agent-id>", "agent UUID")
        .argument("<fact-id>", "fact ID")
        .option("--reason <value>", "deletion reason", "user_request"))
        .action(async (agentID, factID, options) => {
        const client = await AgentGatewayClient.fromConfig();
        const payload = { reason: options.reason, end_user_id: options.endUserId };
        await confirmRegistryMutation({
            action: "delete",
            endpoint: client.getEndpoint(),
            payload,
            resource: "fact",
            resourceID: factID,
        });
        printJSON(await client.deleteWithBody(`/v1/agents/${encodeURIComponent(agentID)}/memory/facts/${encodeURIComponent(factID)}`, payload));
    });
    memory.addCommand(facts);
    return memory;
}
function addMemoryEndUserOption(command) {
    return command.requiredOption("--end-user-id <id>", "terminal user ID within the configured production line");
}
function withMemoryEndUser(payload, endUserId) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("memory payload must be a JSON/YAML object");
    }
    return { ...payload, end_user_id: endUserId };
}
