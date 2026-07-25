# seaagent

> Beta: CLI behavior follows the current `agent-gateway` API and may change with gateway releases.

`seaagent` is the npm CLI for `agent-gateway` registration, discovery, chat, hooks, and sandbox-run workflows.

## Available Workflows

| Workflow | Commands | What it does |
| --- | --- | --- |
| Self maintenance | `seaagent self ...` | Check CLI updates, update the CLI, verify local support files, and install the bundled Codex skill |
| Configuration | `seaagent config ...` | Store endpoint, API key, and production-line user ID in `~/.seaagent/config.yaml` |
| System and catalog | `seaagent system ...`, `seaagent catalog ...` | Check gateway health, metrics, and reusable capabilities |
| Tools | `seaagent tool ...` | Register, list, inspect, resolve, update, and delete executable tools |
| Skills | `seaagent skill ...` | Register, list, inspect, update, and delete agent-facing instructions plus tool bindings |
| Agents | `seaagent agent ...` | Register, inspect, verify, and manage agent memory |
| Chat | `seaagent chat ...` | Run registered or inline agents, stream responses, replay events, and cancel runs |
| Hooks | `seaagent hook ...` | Manage the multimodal charge reservation hook for the configured API key |
| Sandbox runs | `seaagent sandbox ...` | Create, inspect, stream, and operate remote sandbox workspaces |
| Legacy sandbox alias | `seaagent game ...` | Compatibility alias for deployments that still use `/v1/game/runs` |

## How It Works

1. `seaagent` reads connection settings from `~/.seaagent/config.yaml`.
2. `endpoint` may be the gateway base URL or a URL that already includes `/agent-v2`; the CLI appends `/agent-v2` when needed.
3. Requests send `Authorization: Bearer <api-key>` and `X-User-ID: <user-id>` when configured.
4. Registry writes use `user-id` for owner/operator-sensitive gateway behavior.
5. Chat defaults to SSE streaming, can switch to WebSocket with `--ws`, and can replay stored events by chat ID.
6. Sandbox commands manage remote workspace runs created directly or by agents with `runtime.sandbox`.

## Quick Start

Install from GitHub:

```bash
npm install -g git+https://github.com/SeaArt-Infra/sea-agent-cli.git
```

For local development:

```bash
npm install
npm run build
npm link
```

Configure a gateway and check connectivity:

```bash
seaagent config set endpoint http://127.0.0.1:8080
seaagent config set api-key sa-xxxxxxxx
seaagent config set user-id production-line-123
seaagent config get
seaagent system health
```

Discover and run:

```bash
seaagent catalog list --capability-type skill --status active
seaagent tool list --search web --status active
seaagent agent list --status active
seaagent chat run <agent-id> "hello"
```

## Configuration

The CLI stores config in `~/.seaagent/config.yaml`:

```bash
seaagent config set endpoint http://127.0.0.1:8080
seaagent config set api-key sa-xxxxxxxx
seaagent config set user-id production-line-123
seaagent config get
seaagent config path
```

Credentials are sent as:

```http
Authorization: Bearer sa-xxxxxxxx
X-User-ID: production-line-123
```

Set `SEAAGENT_DEBUG=1` to print HTTP and WebSocket requests:

```bash
SEAAGENT_DEBUG=1 seaagent system health
```

The CLI checks GitHub for package updates at most once per day and checks the bundled `seaagent-cli` Codex skill against `~/.codex/skills/seaagent-cli` at most every 2 hours. Notices are printed to stderr only.

```bash
seaagent self check-update
seaagent self update
seaagent self check
seaagent self update-skill
```

## Discovery

Use catalog and list commands before creating new resources:

```bash
seaagent catalog list --capability-type skill --status active
seaagent tool list --search image --status active --limit 50
seaagent skill list --search media --status active
seaagent agent list --category fabric --status active
```

Common list filters:

| Resource | Filters |
| --- | --- |
| Catalog | `--capability-type`, `--search`, `--status`, `--public`, `--provider`, `--limit`, `--offset` |
| Tools | `--search`, `--status`, `--public`, `--provider`, `--limit`, `--offset` |
| Skills | `--search`, `--status`, `--public`, `--provider`, `--limit`, `--offset` |
| Agents | `--search`, `--status`, `--owner-id`, `--category`, `--limit`, `--offset` |

List commands print compact tables. `get`, `register`, `update`, and action commands print JSON.

## Register Resources

Commands with `-f/--file` read JSON or YAML payload files. Use the examples as starting points:

| File | Purpose |
| --- | --- |
| `examples/tool-web-fetch.json` | Tool register payload |
| `examples/skill-web.json` | Skill register payload |
| `examples/agent-web.json` | Agent register payload |
| `examples/agent-sandbox.json` | Registered sandbox agent payload |
| `examples/hook.json` | Hook endpoint payload |
| `examples/runtime-agent-config.json` | Inline runtime chat config |
| `examples/runtime-agent-sandbox-config.json` | Inline runtime chat config that creates a sandbox |
| `examples/chat-multimodal.json` | OpenAI-style multimodal chat messages |

Work bottom-up when building capabilities:

```bash
seaagent tool register -f examples/tool-web-fetch.json
seaagent tool resolve <tool-id>
seaagent skill register -f examples/skill-web.json
seaagent agent register -f examples/agent-web.json
seaagent agent capabilities <agent-id>
```

Tool, Skill, and Agent IDs are immutable UUIDs generated by `agent-gateway`. Use returned UUIDs in later `get`, `update`, `delete`, `resolve`, `capabilities`, skill bindings, and chat commands. Hook update and delete use the configured API key as the Hook identity.

Agent `skills` remains the complete Skill UUID array. To preload a short
instruction that every run needs, repeat its UUID in `pre_skills`. Gateway
resolves each `pre_skills` entry into the Agent system prompt and avoids that
Worker's initial `read_file` call for `SKILL.md`; other bound Skills remain
progressively loaded by Worker. `pre_skills` must be a duplicate-free subset
of `skills`. All bound Skills still keep their required and optional tools.

Tool notes:

- Use `tool resolve` before binding a tool into a skill; it shows normalized runtime metadata.
- `service_name` is a top-level Tool field beside `name`; if omitted, the gateway derives it from the endpoint host.
- Do not send `inject_user_credentials` in user-facing payloads; the gateway manages it.

Skill notes:

- Skills are agent-facing instructions plus tool bindings.
- Prefer immutable Tool UUID refs for registered tools.
- `skill tool-register` is a convenience alias for `tool register`.

Agent notes:

- `category` should be `fabric` or `seaactor`.
- Do not send `agent_key` for new registrations; the gateway returns an immutable UUID.
- Use `agent capabilities <agent-id>` after agent or skill changes to verify resolved bindings.

Memory notes:

- `agent memory list/export` reads medium- and long-term memory for the configured `X-User-ID`.
- `agent memory update/delete` corrects or forgets one medium-term item.
- `agent memory facts list/create/update/delete` manages versioned long-term facts.
- The gateway derives `user_id` and `agent_record_id`; do not put either field in payload files.

```bash
seaagent agent memory list <agent-id>
seaagent agent memory export <agent-id>
seaagent agent memory facts list <agent-id> --status active
seaagent agent memory facts create <agent-id> -f fact.json
```

Hook notes:

- Hook commands use the configured API key as `Authorization: Bearer <api-key>`.
- One API key owns at most one active Hook. Registration creates it and returns `409 Conflict` when one is already active; after deletion, the same API key can register again.
- Hook payload fields are `name`, `endpoint`, and `description`.
- Worker calls the endpoint with fixed `POST`. Phase one sends only `multimodal.charge.reserve`.
- Callback `metadata` comes from each chat request.
- For `multimodal.charge.reserve`, approval returns `{"approved":true}`; rejection can return `{"approved":false,"code":"...","message":"..."}`. The full event-specific request and response contract is in [Hook Management](skills/seaagent-cli/references/capability-formats.md#event-multimodalchargereserve).

## Chat

Run a registered agent:

```bash
seaagent chat run <agent-id> "Search recent AI news"
seaagent chat run --ws <agent-id> "Stream over WebSocket"
seaagent chat run --stream-retries 5 <agent-id> "Limit reconnect attempts"
seaagent chat run --no-stream <agent-id> "Return raw JSON"
```

Run with inline runtime config:

```bash
seaagent chat run --agent-config-file examples/runtime-agent-config.json "Fetch https://example.com"
seaagent chat run --agent-config-file examples/runtime-agent-sandbox-config.json "Create a small React game"
```

Send a messages array or full chat payload file:

```bash
seaagent chat run --messages-file examples/chat-multimodal.json <agent-id>
```

Object payload files can include any `ChatCompletionRequest` fields, such as `agent_id`, `skill_ids`, `model`, `stream`, and `metadata.session_id` / `metadata.user_id`. Positional `<agent-id>`, `--skill-id`, `--model`, and `--agent-config-file` override the same fields from the file. `skill_ids` temporarily mounts extra active, visible Skills for a registered Agent run, is capped at 20 UUIDs, merges after the Agent's own Skills, and cannot be used with `agent_config`.

Inspect and replay existing chats:

```bash
seaagent chat get <chat-id>
seaagent chat events <chat-id> --after-seq 12 --limit 1000
seaagent chat stream <chat-id> --after-seq 12
seaagent chat stream --ws <chat-id> --after-seq 12
seaagent chat cancel <chat-id>
```

Streaming writes assistant text to stdout. The CLI prints `run_id`, progress/tool status, terminal usage, and `langfuse_trace_id` to stderr when available. `--no-stream` prints gateway JSON and enriches stored success or failure details, including `response.metadata.langfuse_trace_id`, when chat events are available.

For the chat response protocol, see [docs/agent-response-protocol.md](docs/agent-response-protocol.md).

## Sandbox Runs

Create and manage remote workspaces with the `sandbox` command:

```bash
seaagent sandbox create --prompt "Create a small React game" --sandbox-template react-game --preview-port 3000
seaagent sandbox get <sandbox-run-id>
seaagent sandbox events <sandbox-run-id> --after-seq 0 --limit 100
seaagent sandbox stream <sandbox-run-id> --after-seq 0
seaagent sandbox logs <sandbox-run-id> --limit 100
seaagent sandbox files <sandbox-run-id> --path /agent-workspace
seaagent sandbox read <sandbox-run-id> --path /agent-workspace/package.json
seaagent sandbox archive <sandbox-run-id> --path /agent-workspace -o workspace.tgz
seaagent sandbox command <sandbox-run-id> -c "npm test" --cwd /agent-workspace --timeout 120
seaagent sandbox refresh <sandbox-run-id>
seaagent sandbox resume <sandbox-run-id>
seaagent sandbox delete <sandbox-run-id>
```

`seaagent game ...` remains as a legacy alias for deployments and scripts that still use `/v1/game/runs`.

## Command Reference

| Area | Commands |
| --- | --- |
| Self | `check-update`, `update`, `check`, `update-skill` |
| Config | `set endpoint`, `set api-key`, `set user-id`, `get`, `path` |
| System | `health`, `metrics` |
| Catalog | `list` |
| Tools | `register`, `list`, `find`, `get`, `update`, `resolve`, `delete` |
| Skills | `register`, `tool-register`, `list`, `get`, `update`, `delete` |
| Agents | `register`, `list`, `get`, `update`, `capabilities`, `delete` |
| Hooks | `register`, `update`, `delete` |
| Chat | `run`, `get`, `events`, `stream`, `cancel` |
| Sandbox | `create`, `get`, `events`, `stream`, `logs`, `files`, `read`, `archive`, `command`, `refresh`, `resume`, `delete` |

Use command-level help for exact flags:

```bash
seaagent <command> --help
seaagent <command> <subcommand> --help
```

## Next Steps

- Use `examples/` payloads as templates for registry and chat workflows.
- Use `seaagent tool resolve` before adding a Tool UUID to a Skill.
- Use `seaagent agent capabilities` after Agent or Skill changes.
- Read [docs/agent-response-protocol.md](docs/agent-response-protocol.md) when integrating with chat JSON, SSE, WebSocket, or replay output.
