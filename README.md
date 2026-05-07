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
agentctl tool register -f examples/tool-web-fetch.json
agentctl tool find --provider web-tools-mcp --status active

agentctl skill register -f examples/skill-web.json
agentctl skill list --status active

agentctl agent register -f examples/agent-web.json
agentctl agent create -f examples/agent-create-web.json
agentctl agent list
agentctl agent capabilities web_assistant:v1

agentctl chat run web_assistant:v1 "Search recent AI news"
agentctl chat run --agent-config-file examples/runtime-agent-config.json "Fetch https://example.com"
```
