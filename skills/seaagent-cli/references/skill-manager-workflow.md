# Skill Manager Workflow

Use this workflow when a user wants to create or update a SeaAgent Skill through
the `seaagent` CLI. It captures the SeaInfra Skill Manager Agent logic and
adapts it to CLI commands.

This workflow manages Skill definitions and Tool bindings. It does not create
Agents unless the user explicitly asks for the broader Tool -> Skill -> Agent
flow.

## Entry Conditions

Start by identifying the operation:

- Create a new Skill from a capability idea.
- Modify an existing Skill by immutable Skill UUID.
- Choose Tools for a Skill.
- Produce a valid Skill payload without mutating the gateway yet.

For update, require the exact Skill UUID and fetch current state:

```bash
seaagent skill get <skill-id>
```

## Required Inputs

Clarify the minimum product behavior before writing payloads:

- Skill name or capability name.
- Production-line/provider for the target Skill.
- Capability goal and trigger scenario.
- User inputs the Agent will receive.
- Expected output and success criteria.
- Operating style, failure behavior, and safety boundaries.

Do not ask the user for internal fields such as owner ids unless the gateway
context explicitly requires them.

## Tool Selection

When the user does not know exactly which Tools to bind, start broad and filter
locally:

```bash
seaagent tool list --status active --limit 100
```

Use focused searches only as a second step:

```bash
seaagent tool list --search image --status active --limit 100
seaagent tool list --search video --status active --limit 100
seaagent tool list --search database --status active --limit 100
```

Do not pass a long natural-language requirement as `--search`. Page with
`--offset` if needed. Choose the smallest sufficient Tool set, usually one to
three Tools.

For each selected registered Tool, inspect runtime behavior before binding:

```bash
seaagent tool resolve <tool-id>
```

Only bind visible active Tools that include a UUID and a known `runtime_type`.
If a requested Tool is missing, inactive, unauthorized, or ambiguous, stop and
ask how to proceed instead of substituting another Tool silently.

## Payload Assembly

Prefer concise Skill payloads:

```json
{
  "name": "provider-capability-skill",
  "description": "One-line routing summary.",
  "provider": "<provider-or-production-line>",
  "required_tools": [
    {"ref": "<tool-uuid>", "type": "http"}
  ],
  "instruction": "Full markdown operating instructions.",
  "public": false,
  "enabled": true
}
```

Rules:

- `name` must match `^[a-z0-9-]+$`: lowercase letters, digits, and hyphens.
- Derive new names as `<provider-slug>-<capability-slug>-skill` unless the user gave a valid explicit name.
- Preserve an existing Skill name during update unless the user asks to rename it.
- `description` must be short and routable; put detailed behavior in `instruction`.
- `required_tools` must use object refs: `{"ref": "<tool-uuid>", "type": "<runtime_type>"}`.
- Use the selected Tool record or `tool resolve` result for `type`; do not assume every Tool is `http`.
- Omit `optional_tools` unless compatibility with an existing payload requires it.
- Omit `config` unless the user explicitly needs runtime config or an existing Skill config must be preserved.
- Keep `public: false` unless the user explicitly asks for public visibility.
- Do not send removed fields such as `skill_key`, `slug`, `entry_file`, `dependencies`, `bundle_uri`, `checksum`, or `owner_id`.
- Do not put secrets in payloads.

The `instruction` should include:

- Role and purpose.
- When to use each required Tool.
- Parameter selection and validation rules.
- Output format and artifact/id return contract.
- Failure handling and when to ask the user for more input.
- Boundaries, including what the Skill must not do.

## Create Flow

1. Confirm `seaagent config get` points at the intended endpoint.
2. Clarify behavior and target provider.
3. List active Tools and choose the smallest sufficient set.
4. Resolve selected Tools.
5. Draft the Skill instruction and payload.
6. Show a summary and the full payload.
7. Ask for explicit approval.
8. Register only after approval:

```bash
seaagent skill register -f <payload.json|yaml>
```

9. Verify:

```bash
seaagent skill get <skill-id>
```

## Update Flow

1. Require the exact Skill UUID.
2. Fetch current state with `seaagent skill get <skill-id>`.
3. Summarize the current name, provider, description, required Tools, and instruction structure.
4. Preserve fields the user did not ask to change.
5. If Tool bindings change, list and resolve active Tools before editing `required_tools`.
6. Show before/after summary and the full final payload.
7. Ask for explicit approval.
8. Update only after approval:

```bash
seaagent skill update <skill-id> -f <payload.json|yaml>
```

9. Verify with `seaagent skill get`. If the Skill is mounted on an Agent, also verify:

```bash
seaagent agent capabilities <agent-id>
```

## Failure Handling

- If provider, selected Tools, or required Tool runtime types are unknown, pause and ask for the missing information.
- If the visible Tool list is unavailable or authorization fails, say that the current Tool environment is unavailable and do not invent Tool ids.
- If publish/update fails, report the gateway error, payload path, and whether any prior resources were changed.
