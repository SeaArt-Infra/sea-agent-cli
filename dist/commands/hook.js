import { Command } from "commander";
import { AgentGatewayClient } from "../lib/client.js";
import { readPayload } from "../lib/files.js";
import { addHelpText, payloadFileHelp } from "../lib/help.js";
import { printJSON } from "../lib/output.js";
export function hookCommand() {
    const cmd = addHelpText(new Command("hook").description("Manage the multimodal charge reservation hook for the configured API key"), `
Hooks are owned by the configured API key. Payload fields are name, endpoint,
and description. The CLI sends the configured key as Authorization:
Bearer <api-key>.

${payloadFileHelp}

Examples:
  seaagent hook register -f examples/hook.json
  seaagent hook update -f examples/hook.json
  seaagent hook delete
`);
    cmd
        .command("register")
        .description("Register the hook for the configured API key")
        .requiredOption("-f, --file <path>", "JSON/YAML hook payload file")
        .addHelpText("after", `

Example:
  seaagent hook register -f examples/hook.json`)
        .action(async (options) => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.post("/v1/hooks/register", await readPayload(options.file)));
    });
    cmd
        .command("update")
        .description("Update the hook for the configured API key")
        .requiredOption("-f, --file <path>", "JSON/YAML hook payload file")
        .addHelpText("after", `

Example:
  seaagent hook update -f examples/hook.json`)
        .action(async (options) => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.put("/v1/hooks", await readPayload(options.file)));
    });
    cmd
        .command("delete")
        .description("Delete the hook for the configured API key")
        .action(async () => {
        const client = await AgentGatewayClient.fromConfig();
        printJSON(await client.delete("/v1/hooks"));
    });
    return cmd;
}
