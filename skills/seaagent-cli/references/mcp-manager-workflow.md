# MCP Manager Workflow

Use this workflow when a user wants to register, update, inspect, delete, or
invoke an independently managed MCP server through `seaagent`. It covers the
gateway's `/v1/mcps` API and does not create Tool records, synchronize tools
into the Tool registry, or modify Agent runtime bindings.

## Entry Conditions

Identify the intended operation first:

- Register a remote MCP server.
- Update or delete a server by immutable MCP server UUID.
- Inspect a server or list servers visible to the configured production line.
- Discover upstream tools with `mcp tools`.
- Invoke one upstream tool with `mcp call`.
- Produce a payload or review configuration without mutating gateway state.

For update, delete, discovery, or a call, require the exact MCP server UUID.
Use `seaagent mcp list --search <value>` only to locate a candidate, then use
`seaagent mcp get <mcp-id>` before taking a write action.

## Required Inputs

For register or update, collect:

- A stable server name and a short description.
- The exact absolute `http` or `https` `server_url`.
- Transport: `streamable-http` by default, or legacy `sse`.
- Visibility (`public`) and status when the default active private record is not appropriate.
- Optional metadata object.
- Optional upstream request headers, without putting secret values in a shared file, transcript, or commit.

For a proxied call, collect:

- MCP server UUID.
- Upstream tool name.
- JSON-object arguments.
- Optional timeout from `0` through `120000` milliseconds.

The gateway derives the MCP `provider` from the configured `X-User-ID`; do not
ask the user to put `provider`, `id`, or `version` in an MCP payload.

## Discovery

Before registering, inspect visible records to avoid duplicates:

```bash
seaagent mcp list --search <server-name> --status active
```

After identifying a server, inspect its safe metadata and upstream schema:

```bash
seaagent mcp get <mcp-id>
seaagent mcp tools <mcp-id>
```

Gateway responses expose `header_keys`, never stored header values. Do not use
a response as an update payload. For a private server, `tools` and `call`
require the configured `user-id` to match the provider unless gateway grants
administrative access.

## Payload Assembly

Prefer this register shape:

```json
{
  "name": "sea-search",
  "description": "Internal search MCP service.",
  "server_url": "https://mcp.example.com/mcp",
  "transport": "streamable-http",
  "headers": {},
  "public": false,
  "status": "active",
  "metadata": {}
}
```

Rules:

- `name` and `server_url` are required; `server_url` must be an absolute HTTP(S) URL.
- `transport` defaults to `streamable-http`; only `streamable-http` and `sse` are valid.
- `metadata` and `arguments` must be JSON objects when supplied.
- `headers` is written only to gateway storage and is not returned. Keep it empty unless the upstream service needs explicit headers.
- On update, omit `headers` to preserve existing header values; send `"headers": {}` to clear them.
- Do not treat this resource as a `runtime_type: "mcp"` Tool. It remains outside the Tool -> Skill -> Agent flow.

The call shape is:

```json
{
  "name": "search",
  "arguments": {"query": "hello"},
  "timeout_ms": 30000
}
```

Omit `timeout_ms` or use `0` for the gateway default. `mcp call` returns the
upstream MCP result, including `isError`; a tool-level error is not automatically
turned into a failed HTTP request.

## Register Flow

1. Confirm `seaagent config get` points at the intended gateway and has a production-line `user-id`.
2. Search existing MCP servers by name.
3. Build a task-specific payload. Do not modify `examples/mcp-search.json` unless the user requests it.
4. Show the endpoint, operation, payload summary, and full payload without revealing secrets.
5. Ask for explicit approval.
6. Register after approval:

```bash
seaagent mcp register -f <payload.json|yaml>
```

7. Verify with `mcp get` and `mcp tools`.

The CLI adds `X-Flag: 1` for the write. Gateway still requires the configured
`X-User-ID` and may reject writes in a protected release environment.

## Update and Delete Flow

1. Require the exact MCP UUID and fetch current safe metadata with `mcp get`.
2. Preserve fields the user did not ask to change. In particular, do not add a `headers` field unless the user intends to replace or clear stored headers.
3. Show before/after summary and the final payload without secrets.
4. Ask for explicit approval.
5. Update or delete:

```bash
seaagent mcp update <mcp-id> -f <payload.json|yaml>
seaagent mcp delete <mcp-id>
```

6. Verify an update with `mcp get` and `mcp tools`. A delete is soft; use `mcp get <mcp-id> --include-deleted` only when inspection is necessary.

## Tool Call Flow

1. Use `mcp tools <mcp-id>` to confirm the upstream tool name and input schema.
2. Build the smallest valid JSON-object arguments payload.
3. Show the MCP server UUID, tool name, arguments summary, and timeout.
4. Ask for explicit approval. A call can perform an arbitrary upstream action.
5. Invoke only after approval:

```bash
seaagent mcp call <mcp-id> -f <call.json|yaml>
```

6. Inspect `isError` in the returned MCP result. Do not claim success when it is true.

## Failure Handling

- Missing or malformed `server_url`, unsupported transport, invalid status, or non-object metadata/arguments produces a gateway validation error; correct the payload rather than guessing fields.
- `403` for a private server means the configured production line is not its provider and no administrative access is available.
- `404` from `tools` or `call` can mean the server is deleted or not active.
- `502` indicates an upstream MCP connection or protocol error; `504` indicates timeout. Preserve the MCP UUID, operation, and safe payload summary for retry or backend diagnosis.
- If the returned MCP result has `isError: true`, handle it as an upstream tool result rather than assuming the proxy transport failed.
