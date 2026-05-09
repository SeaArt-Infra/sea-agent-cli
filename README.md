# agentctl

npm CLI for `agent-gateway`.

## Install

```bash
npm install
npm run build
npm link
```

## Configure

```bash
agentctl config set endpoint http://127.0.0.1:8080
agentctl config set api-key sa-xxxxxxxx
agentctl config get
```

The API key is sent as:

```http
Authorization: Bearer sa-xxxxxxxx
```

## Usage

```bash
agentctl system health
agentctl catalog list --capability-type skill --status active

agentctl tool register -f examples/tool-web-fetch.json
agentctl tool find --provider web-tools-mcp --status active
agentctl tool get <tool-id>
agentctl tool update <tool-id> -f tool-update.json
agentctl tool delete <tool-id> --operator-id web-tools-mcp

agentctl skill register -f examples/skill-web.json
agentctl skill list --status active
agentctl skill get <skill-id>
agentctl skill update <skill-id> -f skill-update.json
agentctl skill delete <skill-id> --operator-id web-tools-mcp

agentctl agent register -f examples/agent-web.json
agentctl agent update <agent-id> -f agent-update.json
agentctl agent delete <agent-id> --operator-id web-tools-mcp
agentctl agent list
agentctl agent capabilities web_assistant:v1

agentctl chat run web_assistant:v1 "Search recent AI news"
agentctl chat run --ws web_assistant:v1 "Search recent AI news"
agentctl chat run --agent-config-file examples/runtime-agent-config.json "Fetch https://example.com"
agentctl chat get <chat-id>
agentctl chat events <chat-id>
agentctl chat stream <chat-id>
agentctl chat stream --ws <chat-id>
agentctl chat cancel <chat-id>
```
