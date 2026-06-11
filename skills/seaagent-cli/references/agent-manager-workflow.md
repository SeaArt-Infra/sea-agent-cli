# Agent Manager Workflow

Use this workflow when a user wants to create or update a SeaAgent Agent through
the `seaagent` CLI. It captures the SeaInfra Agent Manager Agent logic and
adapts it to CLI commands.

This workflow manages Agent records and Skill bindings. It does not create
Tools or Skills unless the user explicitly asks for the full bottom-up flow.

## Entry Conditions

Start by identifying the operation:

- Create a new Agent from a product/capability idea.
- Modify an existing Agent by immutable Agent UUID.
- Choose Skills for an Agent.
- Produce a valid Agent payload without mutating the gateway yet.

For update, require the exact Agent UUID and fetch current state:

```bash
seaagent agent get <agent-id>
seaagent agent capabilities <agent-id>
```

## Required Inputs

Clarify the minimum Agent behavior before writing payloads:

- Agent name or capability name.
- Target `owner_id` or production-line identity.
- User inputs and expected outputs.
- Usage scenario and success criteria.
- Desired category: `fabric` by default, `seaactor` only when explicitly needed.
- Any model policy, runtime config, hooks, or sandbox requirements.

Do not ask users to fill Tool or Skill payload fields when the task is only an
Agent change.

## Skill Selection

When the user does not know exactly which Skills to mount, start broad and
filter locally:

```bash
seaagent skill list --status active --limit 100
```

Use focused searches only as a second step:

```bash
seaagent skill list --search image --status active --limit 100
seaagent skill list --search video --status active --limit 100
seaagent skill list --search debug --status active --limit 100
```

Do not pass a long natural-language requirement as `--search`. Page with
`--offset` if needed. Choose the smallest sufficient Skill set, usually one to
three Skills.

If matches are missing, inactive, unauthorized, or ambiguous, ask the user how
to proceed instead of guessing a Skill id.

## Payload Assembly

Agent payloads use Agent fields only. Use `owner_id`, not `provider`, and
`system_prompt`, not `instruction`.

For new manager-style Agents, the SeaInfra manager defaults are:

```json
{
  "name": "owner-capability-agent",
  "category": "fabric",
  "owner_id": "<production-line>",
  "status": "active",
  "metadata": {},
  "model_config": {
    "default": "gpt-5.5",
    "allowed": ["gpt-5.5"],
    "reasoning_effort": "high"
  },
  "system_prompt": "Role, workflow, output contract, and failure behavior.",
  "agent_config": {},
  "skills": ["<skill-uuid>"],
  "version": "v1"
}
```

Use user-specified or project-specific model policy when provided. For SeaArt
media Agents, check the known-good model guidance in the main `SKILL.md`
instead of copying the manager defaults blindly.

Rules:

- Preserve an existing Agent name during update unless the user asks to rename it.
- For new names, use a stable lowercase slug and do not append UUIDs, timestamps, version text, or random suffixes.
- `category` must be `fabric` or `seaactor`.
- `skills` contains only Skill UUIDs/refs, never Tool refs.
- Omit `agent_config` for new Agents unless runtime settings are needed; preserve existing `agent_config` during updates unless the user changes it.
- `metadata` is stored as `{}` by the gateway; do not put display metadata there.
- Do not send Skill-only fields such as `provider`, `description`, `instruction`, `required_tools`, `optional_tools`, `public`, or `enabled` inside the Agent object.
- Do not send removed/display-only Agent fields such as `agent_key`, `display_name`, `tags`, or `permissions`.

The `system_prompt` should include:

- Role and target user.
- Goals and non-goals.
- Workflow steps.
- When to rely on each mounted Skill.
- Output format and artifact/id return contract.
- Failure handling and when to ask the user for missing information.
- Boundaries, including what the Agent must not claim or do.

## Create Flow

1. Confirm `seaagent config get` points at the intended endpoint.
2. Clarify behavior, `owner_id`, category, and model policy.
3. List active Skills and choose the smallest sufficient set.
4. Draft `system_prompt` and the Agent payload.
5. Show a summary and the full payload.
6. Ask for explicit approval.
7. Register only after approval:

```bash
seaagent agent register -f <payload.json|yaml>
```

8. Verify:

```bash
seaagent agent get <agent-id>
seaagent agent capabilities <agent-id>
```

9. Run a no-tool smoke test before expensive workflows:

```bash
seaagent chat run --no-stream <agent-id> "请用一句话说明你能做什么，不要调用任何工具。"
```

## Update Flow

1. Require the exact Agent UUID.
2. Fetch current state with `seaagent agent get <agent-id>`.
3. Inspect `name`, `owner_id`, `category`, `version`, model policy, `agent_config`, `system_prompt`, and mounted Skills.
4. Preserve fields the user did not ask to change.
5. If Skill bindings change, list active Skills and use only visible active Skill ids.
6. Build the full low-level Agent update payload. `agent update` does not accept partial patch semantics.
7. Show before/after summary and the full final payload.
8. Ask for explicit approval.
9. Update only after approval:

```bash
seaagent agent update <agent-id> -f <payload.json|yaml>
```

10. Verify with `agent get`, `agent capabilities`, and a no-tool smoke test when runnable.

## Failure Handling

- If `owner_id`, target Skills, or model policy are unknown and required, pause and ask.
- If `agent get` returns not found, forbidden, unauthorized, or a permission-scoped empty result, ask for a valid id or correct production-line context. Do not recreate or overwrite a different Agent.
- If a newly registered Agent times out on the no-tool smoke test, fix category/model config before debugging Tools.
- If update fails, report the gateway error, payload path, and fields that were intended to change.
