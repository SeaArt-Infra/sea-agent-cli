import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { confirmRegistryMutation } from "../lib/confirmation.js";
import { readPayload } from "../lib/files.js";
import { addHelpText, commonListHelp, payloadFileHelp } from "../lib/help.js";
import { printJSON, printTable } from "../lib/output.js";

export function mcpCommand(): Command {
  const cmd = addHelpText(new Command("mcp").description("Manage registered MCP servers and proxy their tools"), `
MCP servers are independent gateway resources. Their configured upstream headers
are stored by gateway and never returned; responses expose only header_keys.
Use immutable MCP server UUIDs for get, update, delete, tools, and call.

${commonListHelp}

${payloadFileHelp}

Examples:
  seaagent mcp register -f examples/mcp-search.json
  seaagent mcp list --status active
  seaagent mcp tools <mcp-id>
  seaagent mcp call <mcp-id> -f examples/mcp-call.json
`);

  cmd
    .command("register")
    .description("Register an MCP server via /v1/mcps/register")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

The payload requires name and server_url. transport defaults to streamable-http;
use sse only for a legacy MCP endpoint. Registry mutations require the configured
user-id and are confirmed before this command sends X-Flag: 1.`)
    .action(async (options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
        action: "register",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "mcp",
      });
      printJSON(await client.postRegistry("/v1/mcps/register", payload));
    });

  cmd
    .command("list")
    .description("List MCP servers visible to the configured production line")
    .option("--search <value>", "search server names")
    .option("--status <value>", "draft, active, deprecated, disabled, or deleted")
    .option("--public <true|false>", "filter by public visibility")
    .option("--provider <value>", "provider namespace")
    .option("--include-deleted", "include soft-deleted records")
    .option("--limit <number>", "page size", "20")
    .option("--offset <number>", "page offset", "0")
    .action(async (options) => {
      const client = await AgentGatewayClient.fromConfig();
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
    });

  cmd
    .command("get")
    .description("Get one MCP server by immutable UUID")
    .argument("<mcp-id>", "MCP server UUID")
    .option("--include-deleted", "include a soft-deleted record")
    .action(async (mcpID: string, options: { includeDeleted?: boolean }) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.get(`/v1/mcps/${encodeURIComponent(mcpID)}`, {
        include_deleted: options.includeDeleted,
      }));
    });

  cmd
    .command("update")
    .description("Update an MCP server via /v1/mcps/{mcp-id}")
    .argument("<mcp-id>", "MCP server UUID")
    .requiredOption("-f, --file <path>", "JSON/YAML request file")
    .addHelpText("after", `

Omit headers to preserve stored upstream headers. Set headers to {} to clear
them. Gateway never returns header values, so do not copy response data into an
update payload.`)
    .action(async (mcpID: string, options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
        action: "update",
        endpoint: client.getEndpoint(),
        payload,
        payloadPath: options.file,
        resource: "mcp",
        resourceID: mcpID,
      });
      printJSON(await client.putRegistry(`/v1/mcps/${encodeURIComponent(mcpID)}`, payload));
    });

  cmd
    .command("delete")
    .description("Soft-delete an MCP server via /v1/mcps/{mcp-id}")
    .argument("<mcp-id>", "MCP server UUID")
    .action(async (mcpID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      await confirmRegistryMutation({
        action: "delete",
        endpoint: client.getEndpoint(),
        resource: "mcp",
        resourceID: mcpID,
      });
      printJSON(await client.deleteRegistry(`/v1/mcps/${encodeURIComponent(mcpID)}`));
    });

  cmd
    .command("tools")
    .description("Discover tools exposed by an active MCP server")
    .argument("<mcp-id>", "MCP server UUID")
    .action(async (mcpID: string) => {
      const client = await AgentGatewayClient.fromConfig();
      printJSON(await client.get(`/v1/mcps/${encodeURIComponent(mcpID)}/tools`));
    });

  cmd
    .command("call")
    .description("Call a tool through an active MCP server")
    .argument("<mcp-id>", "MCP server UUID")
    .requiredOption("-f, --file <path>", "JSON/YAML body containing name, arguments, and optional timeout_ms")
    .addHelpText("after", `

This command can execute an arbitrary upstream tool, so it requires explicit
interactive confirmation. Private MCP servers require the configured user-id to
match their provider unless the gateway grants X-Admin-Access.`)
    .action(async (mcpID: string, options: { file: string }) => {
      const client = await AgentGatewayClient.fromConfig();
      const payload = await readPayload(options.file);
      await confirmRegistryMutation({
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
