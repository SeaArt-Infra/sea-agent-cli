# Agent Response Protocol

This document summarizes the current Agent Chat response protocol exposed by `agent-gateway` and how the `seaagent` CLI handles those responses.

## Scope

In this document, "response protocol" refers to the protocol returned by Agent Chat APIs to callers, including:

- Non-streaming JSON responses from `POST /v1/chat/completions`.
- SSE streaming responses from `POST /v1/chat/completions`.
- WebSocket responses from `GET /v1/chat/completions/ws` and `GET /v1/chats/{chat-id}/ws`.
- Historical query and replay responses from `GET /v1/chats/{chat-id}`, `GET /v1/chats/{chat-id}/events`, and `GET /v1/chats/{chat-id}/stream`.

This does not cover a Tool's own `response_mode` protocol. `response_mode` describes how Tool-call responses are parsed; it is not the Agent final-response protocol.

## Request Shape

`chat run` builds a `ChatCompletionRequest`:

```json
{
  "request_id": "optional-request-id",
  "agent_id": "owner_id:agent_name:v1",
  "category": "fabric",
  "agent_config": {},
  "messages": [
    {
      "role": "user",
      "content": "hello"
    }
  ],
  "stream": true,
  "metadata": {}
}
```

Field notes:

- `agent_id`: registered Agent ID or key.
- `agent_config`: inline runtime Agent config. It cannot be used together with `agent_id`.
- `messages`: conversation message array.
- `stream`: whether to return a streaming response. The CLI treats requests as streaming by default.
- `category`: scheduling category. Current valid values are `fabric` and `seaactor`.
- `metadata`: pass-through context such as `session_id`, `user_id`, and `api_key`.

`messages[].content` supports either an OpenAI-style string or an array of multimodal content parts:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this image"},
        {"type": "image_url", "image_url": {"url": "https://image.cdn2.seaart.me/static/infra/agent-chat/user-11/image/20260529/e4fc53aac523b4f56e582a65a717381a.png"}}
      ]
    }
  ]
}
```

Use `seaagent chat run --messages-file examples/chat-multimodal.json <agent-id>` to send a full message array from the CLI.

## Non-Streaming Response

When `stream: false`, the API returns `ChatCompletionResponse`:

```json
{
  "run_id": "run_xxx",
  "status": "completed",
  "response": {
    "content": "agent final answer"
  },
  "finish_reason": "stop",
  "error_code": "",
  "error_message": ""
}
```

Field notes:

- `run_id`: ID of this Agent run.
- `status`: run status. Values are `queued`, `running`, `completed`, `failed`, and `cancelled`.
- `response`: `data` content from the final response event. It comes from cached `chat.response` or `response.completed` events.
- `finish_reason`: completion reason.
- `error_code`: error code when the run fails.
- `error_message`: error message when the run fails.

Failure example:

```json
{
  "run_id": "run_xxx",
  "status": "failed",
  "error_code": "agent_error",
  "error_message": "agent execution failed"
}
```

## SSE Streaming Response

Streaming HTTP responses use standard SSE blocks:

```text
event: response.output_text.delta
data: {"delta":"hello"}

event: response.output_text.delta
data: {"delta":" world"}

event: response.completed
data: {"content":"hello world"}
```

The CLI currently recognizes these text-delta events:

- `response.text.delta`: reads `data.delta`.
- `response.output_text.delta`: reads `data.delta`.
- `chat.response`: reads `data.content`, then `data.text`, then `data.delta`.
- `message.delta`: reads `data.content`, then `data.text`, then `data.delta`.

Terminal events:

- `chat.response`: may be used as the final response event.
- `response.completed`: may be used as the final response event.
- `chat.failed`: run failed.
- `chat.cancelled`: run was cancelled.

Sandbox Agent events:

- `chat.sandbox.creating`: the gateway has created a sandbox run from `agent_config.runtime.sandbox`; the event includes `sandbox_run_id` / `game_run_id`.
- `chat.sandbox.ready`: the sandbox is ready; the event includes fields such as `sandbox_run_id`, `workspace_root`, `preview_url`, and `preview_port`.
- `chat.sandbox.failed`: sandbox creation or readiness failed; the event includes `error_code` / `error_message`.

`runtime.sandbox` is an Agent runtime-type marker. It does not use an `enabled` field; the presence of the object means this Agent should automatically start a sandbox. Normal Agents do not configure `runtime.sandbox`.

## WebSocket Response

Each WebSocket message is JSON:

```json
{
  "event": "response.output_text.delta",
  "data": {
    "delta": "hello"
  }
}
```

Error message shape:

```json
{
  "event": "error",
  "code": "agent_error",
  "error": "agent execution failed"
}
```

When the CLI receives `event: "error"`, it throws an error. Other events are rendered with the same text extraction rules used for SSE.

## Historical Query and Replay

### Query Run Status

`GET /v1/chats/{chat-id}` returns `ChatMeta`:

```json
{
  "run_id": "run_xxx",
  "category": "fabric",
  "agent_id": "agent_xxx",
  "agent_name": "example_agent",
  "agent_record_id": "agent_xxx",
  "status": "completed",
  "last_seq": 12,
  "finish_reason": "stop",
  "request_id": "optional-request-id",
  "created_at": 1770000000,
  "created_at_ms": 1770000000000,
  "dispatched_at_ms": 1770000000100,
  "first_token_at_ms": 1770000001200,
  "updated_at": 1770000001,
  "error_code": "",
  "error_message": ""
}
```

### Query Event List

`GET /v1/chats/{chat-id}/events` returns event records:

```json
{
  "run_id": "run_xxx",
  "status": "completed",
  "last_seq": 12,
  "items": [
    {
      "run_id": "run_xxx",
      "seq": 1,
      "raw_sse": "event: response.output_text.delta\ndata: {\"delta\":\"hello\"}\n",
      "source": "proxy",
      "ts": 1770000000
    }
  ]
}
```

### Replay Stream

`GET /v1/chats/{chat-id}/stream` replays historical events in SSE format.

`GET /v1/chats/{chat-id}/ws?after_seq=...` replays historical events in WebSocket JSON message format.

## CLI Behavior

`seaagent chat run` streams by default:

```bash
seaagent chat run <agent-id> "hello"
```

In default streaming mode, the CLI writes text deltas to stdout and does not display the full event envelope. The CLI prints `run_id` to stderr when known. If the terminal event includes `usage`, the CLI also prints a usage summary to stderr after streaming ends.

The CLI records the `run_id` and SSE/WebSocket event sequence numbers from streaming events. If the connection closes abnormally before the run reaches a terminal state, the CLI automatically reconnects without a retry limit by default and resumes through `GET /v1/chats/{chat-id}/stream?after_seq=...` or WebSocket replay. It does not create a new Agent task. Use `--stream-retries <n>` to limit retries; `--stream-retries 0` disables automatic stream resume.

```bash
seaagent chat run <agent-id> "long task"
seaagent chat stream <chat-id> --after-seq 12
```

Non-streaming mode:

```bash
seaagent chat run --no-stream <agent-id> "hello"
```

In non-streaming mode, the CLI prints the full `ChatCompletionResponse` JSON.
When the response includes `run_id`, the CLI additionally reads historical events for that run and stitches together text deltas.
When the final text is successfully reconstructed, it is added to `response.message.content` so scripts can read the Agent's actual reply directly.
If the run fails and historical events contain error events such as `response.failed` / `chat.failed`, the CLI tries to backfill `response.error`, `error_message`, and `error_code`.

WebSocket mode:

```bash
seaagent chat run --ws <agent-id> "hello"
```

In WebSocket mode, the CLI sends the same `ChatCompletionRequest` as the first WebSocket message, then renders text from the event stream.

## Agent Final Content Format

The Agent final content itself currently has no independent structured schema field; for example, there is no `output_schema` or `response_schema`.

If a business flow needs a stable final-answer format, constrain it through the Agent `system_prompt` or Skill `instruction`. For example, require the final answer to be JSON only:

```json
{
  "status": "success",
  "final_video_url": "https://example.com/final.mp4",
  "assets": [],
  "notes": ""
}
```

This kind of format constraint is part of the prompt contract. The gateway does not currently validate it automatically.

## Code Locations

- CLI chat command and streaming renderer: `src/commands/chat.ts`
- Chat request and response models: `agent-gateway/internal/models/chat.go`
- Chat response cache and terminal-state extraction: `agent-gateway/internal/services/chat_service.go`
- CLI chat payload reference: `skills/seaagent-cli/references/capability-formats.md`
