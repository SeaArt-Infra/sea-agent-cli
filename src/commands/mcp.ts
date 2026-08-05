import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { confirmRegistryMutation } from "../lib/confirmation.js";
import { readPayload } from "../lib/files.js";
import { addHelpText, commonListHelp, payloadFileHelp } from "../lib/help.js";
import { printJSON, printTable } from "../lib/output.js";
import { warnProviderNormalized, withRegisterErrorHint } from "../lib/registry-hints.js";

type McpCommandDependencies = {
  createClient?: () => Promise<AgentGatewayClient>;
  confirmMutation?: typeof confirmRegistryMutation;
};

export function mcpCommand(dependencies: McpCommandDependencies = {}): Command {
  const createClient = dependencies.createClient ?? AgentGatewayClient.fromConfig;
  const confirmMutation = dependencies.confirmMutation ?? confirmRegistryMutation;
  const cmd = addHelpText(new Command("mcp").description("Register and inspect MCP servers"), `
MCP servers are independently registered runtime connections for Skills.
Use immutable MCP server UUIDs returned by the gateway for get/update/delete,
tools/call, and Skill config.mcp_servers bindings.

${commonListHelp}

${payloadFileHelp}

Examples:
  seaagent mcp list --status active
  seaagent mcp register -f examples/mcp-streamable-http.json
  seaagent mcp get <mcp-server-id>
  seaagent mcp tools <mcp-server-id>
  seaagent mcp call <mcp-server-id> -f payloads/mcp-call.json
`);

  cmd
    .command("register")
    .description("Register an MCP server via /v1/mcps/register")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Example:
  seaagent mcp register -f examples/mcp-streamable-http.json

For a Skill runtime binding, use an active MCP Server UUID visible to the
configured user. Its endpoint must be unauthenticated Streamable HTTP. The
Server's public field controls cross-production-line sharing; do not set it
unless sharing is intended. Do not put a server URL in a Skill payload.`)
    .action(async (options: { file: string }) => {
      const client = await createClient();
      const payload = await readPayload(options.file);
      await confirmMutation({
        action: "register",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "mcp",
      });
      const response = await withRegisterErrorHint("mcp server", "examples/mcp-streamable-http.json", () => client.post("/v1/mcps/register", payload));
      warnProviderNormalized("mcp server", payload, response);
      printJSON(response);
    });

  const list = async (options: any) => {
    const client = await createClient();
    const response = await client.get("/v1/mcps", {
      search: options.search,
      status: options.status,
      public: options.public,
      provider: options.provider,
      include_deleted: options.includeDeleted,
      limit: options.limit,
      offset: options.offset,
    });
    printTable((response as any).data ?? response);
  };

  cmd
    .command("list")
    .description("List MCP servers visible to the configured user")
    .option("--search <value>", "search text")
    .option("--status <value>", "draft, active, deprecated, disabled, or deleted")
    .option("--public <true|false>", "filter by public visibility")
    .option("--provider <value>", "provider namespace")
    .option("--include-deleted", "include soft-deleted MCP servers when authorized")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .addHelpText("after", `

Examples:
  seaagent mcp list --status active
  seaagent mcp list --search search --status active --limit 50
  seaagent mcp list --provider production-line-123 --public true`)
    .action(list);

  cmd
    .command("get")
    .description("Get one MCP server by immutable UUID")
    .argument("<mcp-server-id>", "MCP server UUID")
    .action(async (mcpID: string) => {
      const client = await createClient();
      printJSON(await client.get(`/v1/mcps/${encodeURIComponent(mcpID)}`));
    });

  cmd
    .command("update")
    .description("Update an MCP server via /v1/mcps/{mcp-server-id}")
    .argument("<mcp-server-id>", "MCP server UUID")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Example:
  seaagent mcp update <mcp-server-id> -f payloads/mcp-update.json`)
    .action(async (mcpID: string, options: { file: string }) => {
      const client = await createClient();
      const payload = await readPayload(options.file);
      await confirmMutation({
        action: "update",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "mcp",
        resourceID: mcpID,
      });
      printJSON(await client.put(`/v1/mcps/${encodeURIComponent(mcpID)}`, payload));
    });

  cmd
    .command("delete")
    .description("Delete an MCP server via /v1/mcps/{mcp-server-id}")
    .argument("<mcp-server-id>", "MCP server UUID")
    .addHelpText("after", `

Example:
  seaagent mcp delete <mcp-server-id>

Delete uses the configured user-id as X-User-ID. The gateway only allows the
MCP server provider to delete the server.`)
    .action(async (mcpID: string) => {
      const client = await createClient();
      await confirmMutation({
        action: "delete",
        endpoint: client.getEndpoint(),
        resource: "mcp",
        resourceID: mcpID,
      });
      printJSON(await client.delete(`/v1/mcps/${encodeURIComponent(mcpID)}`));
    });

  cmd
    .command("tools")
    .description("List tools discovered from an MCP server")
    .argument("<mcp-server-id>", "MCP server UUID")
    .action(async (mcpID: string) => {
      const client = await createClient();
      printJSON(await client.get(`/v1/mcps/${encodeURIComponent(mcpID)}/tools`));
    });

  cmd
    .command("call")
    .description("Call an MCP server tool via /v1/mcps/{mcp-server-id}/call")
    .argument("<mcp-server-id>", "MCP server UUID")
    .requiredOption("-f, --file <path>", "JSON/YAML body containing name, arguments, and optional timeout_ms")
    .addHelpText("after", `

Example:
  seaagent mcp call <mcp-server-id> -f payloads/mcp-call.json

Tool calls can have external side effects, so the CLI requires confirmation.`)
    .action(async (mcpID: string, options: { file: string }) => {
      const client = await createClient();
      const payload = await readPayload(options.file);
      await confirmMutation({
        action: "call",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "mcp",
        resourceID: mcpID,
      });
      printJSON(await client.post(`/v1/mcps/${encodeURIComponent(mcpID)}/call`, payload));
    });

  return cmd;
}
