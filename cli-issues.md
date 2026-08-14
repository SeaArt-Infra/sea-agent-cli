# CLI Newcomer Review Issue List

This document records issues found when using the `seaagent` CLI to create and validate Agents from the perspective of a complete newcomer.

Most recent review: `weather-agent` scenario, 2026-05-21.

## Review Method

- The sub-agent may use only the `seaagent` CLI, help output, README/examples, and read-only query commands.
- The sub-agent does not read source code, modify code, or run gateway write operations such as register/update.
- The main agent reviews the sub-agent command trace and, when needed, retests chat behavior for existing Agents.

## Weather Agent Review Summary

Read-only discovery found these existing resources:

- tool: `e6b281b2-9f7e-4e2f-9661-b2b9dbd3e512` (`weather_lookup`)
- skill: `08c90395-4024-4e6e-8dce-d9bc72d6c2ce` (`weather_skill`)
- agent: `c1bb1c13-f721-4948-92bb-8c0bbc532000` (`weather_assistant`)

The main agent retested with:

```bash
seaagent chat run --no-stream c1bb1c13-f721-4948-92bb-8c0bbc532000 "What's the current weather in Shanghai?"
```

Result:

- `chat run --no-stream` returned `status: failed`, and the raw response did not include error details.
- `chat events` showed the real failure reason in `response.failed`:
  `[Errno -2] Name or service not known`
- This indicates a DNS resolution failure in the Agent/tool runtime environment, and the CLI did not backfill the event error into the non-streaming JSON failure response.

## Pending Fixes / Pending Verification

### 1. Network errors are printed raw without diagnostic guidance

**Severity**: high

**Source**

The weather review repeatedly produced:

```text
getaddrinfo ENOTFOUND openresty-gateway.gpu-service.dev.seaart.dev
```

Users only see the low-level DNS error. They do not know the current endpoint, whether the request is retryable, or whether they should check config or health.

**Expected**

When a network request fails, the CLI should add:

- request method and target endpoint/path
- suggestion to run `seaagent config get`
- suggestion to run `seaagent system health`
- a clear retryability hint

**Status**

`fixed pending verification`: `src/lib/client.ts` now appends diagnostic guidance for HTTP request failures.

### 2. `chat run --no-stream` does not include event error details when a run fails

**Severity**: high

**Source**

The weather agent retest returned:

```json
{
  "data": {
    "run_id": "run_d877m2te878c73c8v16g",
    "status": "failed"
  }
}
```

But `chat events` contained:

```json
{
  "event": "response.failed",
  "response": {
    "error": {
      "message": "[Errno -2] Name or service not known",
      "type": "server_error"
    }
  }
}
```

**Expected**

`--no-stream` enrichment should not only stitch together successful text. When a run fails, it should also copy errors from `response.failed` / `chat.failed` into:

- `response.error`
- `error_message`
- `error_code` when available

**Status**

`fixed pending verification`: `src/commands/chat.ts` now parses nested `response.error` and backfills it into non-streaming JSON.

### 3. Task-oriented Agent creation examples are missing

**Severity**: medium

**Source**

The sub-agent found only web/sandbox examples. When creating a weather agent, a newcomer has to infer the workflow from web examples:

- how to search existing tools/skills first
- how to reuse an existing Skill UUID when creating an Agent
- which fields are required in a minimal Agent payload

**Expected**

Add at least one workflow that reuses an existing Skill to create an Agent. Weather or currency utility agents would both work.

**Status**

`fixed`: README now includes a task-oriented flow that searches active Skills,
binds the returned Skill UUID in an Agent payload, verifies capabilities, and
runs a no-tool smoke test.

### 4. Top-level `agent --help` does not show common list filters

**Severity**: medium

**Source**

The sub-agent used `agent list --search weather`, but inferred it from other commands. The top-level `seaagent agent --help` originally did not show `--search / --status / --owner-id / --category` directly.

**Expected**

Top-level `agent --help` should show common list filters to improve discoverability.

**Status**

`fixed pending verification`: `src/commands/agent.ts` now adds Common list filters to top-level help.

### 5. `config get` does not show the risk of a missing `userId`

**Severity**: medium

**Source**

The sub-agent noticed that `config get` did not show `userId`, but could not tell whether register/update operations would be affected.

**Expected**

`config get` should explicitly show `userId: null` and warn that registry ownership-sensitive operations may use the gateway default owner.

**Status**

`fixed pending verification`: `src/commands/config.ts` now prints `userId: null` and warnings.

### 6. List tables collapse nested fields to `[Object]`

**Severity**: medium

**Source**

`tool list`, `skill list`, and `agent list` use `console.table`, so fields such as `openai_schema`, `manifest`, `metadata`, and `agent_config` appear as `[Object]`.

**Impact**

Newcomers need to run an additional `get` command to inspect tool parameters, Skill bindings, and Agent config.

**Possible Fixes**

- Add a common `--json` output mode.
- Or make list tables show only the most useful summary fields, such as required tool params, Skill required tool IDs, and Agent Skill IDs.

**Status**

`todo`

### 7. The boundary between `tool resolve` and `tool get` is still unclear

**Severity**: low

**Source**

The sub-agent found the outputs very similar and was unsure when `resolve` is required.

**Current Explanation**

`tool resolve --help` now says:

> Use resolve before binding a tool into a skill. It prints the normalized runtime metadata that Agent Worker receives.

**Status**

`watch`: do not change code for now. If later reviews show repeated confusion, add a README workflow note.

### 8. The smoke-test workflow is not explicit enough

**Severity**: low

**Source**

The sub-agent was unsure whether `chat run` counts as read-only validation because it creates a chat run record.

**Explanation**

Chat run creates a run record, but it is not a registry mutation. It can be used as a smoke test. The review protocol and README should state this explicitly.

**Status**

`fixed`: README, the response protocol, and the bundled `seaagent-cli` Skill
now state that `chat run` creates a run record but is not a registry mutation,
so it is valid as a smoke test.

## Fixed / Mitigated

### A. The `agent` command was missing `get`

Original issue: `tool get` and `skill get` existed, but `agent get` was missing.

Status: `fixed`

- CLI now includes `seaagent agent get <agent-id>`
- agent-gateway now includes `GET /v1/agents/:agentID`
- agent-sdk-go/js, skill-hub, and web docs have been synchronized

### B. `chat events` default `--limit 100` silently truncated results

Status: `fixed`

- Default limit is now `1000`
- The CLI warns when exactly `--limit` items are returned and additional pages may exist

### C. Successful `chat run --no-stream` output did not include the Agent's actual reply

Status: `fixed`

- `--no-stream` reads stored events and backfills text deltas into `response.message.content`
- The failed-run enrichment added in this review is covered in item 2 above

### D. `register` 400 errors did not explain field-level problems well enough

Status: `partially fixed`

- `src/lib/client.ts` now expands `message/detail/details/errors`
- Generic register 400 errors now suggest checking the relevant examples
- Full local schema prevalidation has not been implemented

### E. Provider normalization to UUID was not explained

Status: `fixed`

- `tool register` / `skill register` help now explains this behavior
- When a registration response shows that `provider` changed, the CLI prints an info message to stderr
