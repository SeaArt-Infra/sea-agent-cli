# Tool Manager Workflow

Use this workflow when a user wants to create, update, or prepare a SeaAgent
HTTP Tool through the `seaagent` CLI. It captures the SeaInfra Tool Manager
Agent logic and adapts it to local CLI commands.

This workflow manages Tool definitions only. It does not choose Skills, create
Agents, or invoke generated tools directly.

## Entry Conditions

Start by identifying the operation:

- Create one Tool from a known endpoint, manifest entry, or OpenAPI operation.
- Batch-create Tools from a service manifest or interface list.
- Update an existing Tool by immutable Tool UUID.
- Review Tool design without mutating gateway state.

For update, require the exact Tool UUID or enough information to find it with
`seaagent tool list`. Fetch the current record before editing:

```bash
seaagent tool get <tool-id>
seaagent tool resolve <tool-id>
```

## Required Inputs

Collect only the fields that block a valid publish:

- Service base URL or exact endpoint URL.
- HTTP method and path.
- Request parameter schema.
- Response mode: `json` or `sse`.
- Response summary and expected important fields.
- Authentication behavior, without asking for or storing secret values.
- Tool name preference and production-line/provider when needed.

Do not require internal ownership fields from the user unless the current
gateway or API key context needs them.

## Discovery

When the user provides a service base URL or an exact tool URL, try to discover
metadata in this order:

1. `{base_url}/tool-manifest.json`
2. `{base_url}/openapi.json`
3. `{base_url}/tools`
4. Existing Tool state from `seaagent tool get <tool-id>` for updates.
5. User-provided endpoint contract or request/response examples.

The CLI has no dedicated metadata-fetch command. Use available shell/network
tools when allowed, or ask the user to provide the manifest/OpenAPI/schema
content. If metadata is unavailable, pause instead of inventing schema or
runtime behavior.

If the user gives an exact tool endpoint, strip it back to the service base URL
for discovery, then match by path, operation id, or Tool name.

## Manifest Mapping

For SDK `/tool-manifest.json` records, map fields directly:

| Manifest field | CLI Tool payload field |
| --- | --- |
| `server_name` | `service_name` |
| `tools[].name` | `name` |
| `tools[].description` | `description` or `openai_schema.function.description` |
| `tools[].request_schema` | `parameters` or `openai_schema.function.parameters` |
| `tools[].method` | `method` |
| `base_url + tools[].path` | `endpoint` or `metadata.endpoint` |
| `tools[].response_mode` | `response_mode` |
| `tools[].timeout_ms` | `timeout_ms` |

For OpenAPI, use the operation id or stable path-derived name, the
operation summary/description, the request body schema, HTTP method, and full
operation URL. Preserve explicit values from metadata; do not infer over them.

## Payload Assembly

Prefer the concise register shape for new user-facing Tool payloads:

```json
{
  "provider": "<provider-or-production-line>",
  "name": "tool_name",
  "runtime_type": "http",
  "description": "What this tool does.",
  "endpoint": "https://service.example/tools/tool_name",
  "service_name": "service-name",
  "method": "POST",
  "response_mode": "json",
  "parameters": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  },
  "public": false,
  "enabled": true
}
```

Use the low-level shape when preserving a current-state Tool or when the target
gateway requires `openai_schema`, `metadata`, or `runtime_type` trigger fields.
See `capability-formats.md` for exact shapes.

Rules:

- Tool type is usually `runtime_type: "http"` for service endpoints.
- Default `method` to `POST` only after confirming the endpoint contract.
- Do not guess `response_mode`; ask whether the endpoint returns normal JSON or SSE streaming.
- Do not add polling fields without a `poll_endpoint`.
- For no-input tools, use an empty object schema with `additionalProperties: false`.
- Keep `service_name` and `inject_user_credentials` as top-level Tool fields, not metadata fields. Omit `inject_user_credentials` unless preserving existing behavior or the user explicitly requires it.
- Do not send provider credentials, API keys, bearer tokens, passwords, or secret values.
- Do not send removed or display-only fields such as `tool_key`, `slug`, `category`, `tags`, `checksum`, or `owner_id`.

## Create Flow

1. Confirm the configured endpoint with `seaagent config get`.
2. Discover or collect endpoint metadata.
3. If multiple operations match, show candidate names/descriptions and ask the user to choose.
4. Build the Tool payload from metadata.
5. Show a human-readable summary and the full payload.
6. Ask for explicit approval.
7. Register only after approval:

```bash
seaagent tool register -f <payload.json|yaml>
```

8. Verify the created Tool:

```bash
seaagent tool get <tool-id>
seaagent tool resolve <tool-id>
```

## Update Flow

1. Require the exact Tool UUID.
2. Fetch the current Tool with `seaagent tool get <tool-id>`.
3. Preserve fields the user did not ask to change.
4. Apply requested changes only.
5. Show before/after summary and the full final payload.
6. Ask for explicit approval.
7. Update only after approval:

```bash
seaagent tool update <tool-id> -f <payload.json|yaml>
```

8. Verify with `seaagent tool get` and `seaagent tool resolve`.

## Failure Handling

- If endpoint, method/path, parameter schema, authentication behavior, or response mode is unknown, clearly list the missing items and pause.
- If registration fails, report the gateway error, the operation attempted, and the payload file path.
- If the Tool registers but `tool resolve` does not show the expected runtime fields, stop before binding it to a Skill.
- The CLI has no direct `tool invoke` command; runtime testing goes through an Agent chat after the Tool is bound to a Skill.
