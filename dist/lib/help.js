export function addHelpText(command, text) {
    return command.addHelpText("after", `\n${text.trim()}\n`);
}
export const commonListHelp = `Common filters:
  --search <value>      Match resource names, descriptions, or provider-owned metadata
  --status <value>      draft | active | deprecated | disabled | deleted
  --provider <value>    Provider namespace for registry resources
  --limit <number>      Page size, normally 1..200
  --offset <number>     Zero-based page offset`;
export const payloadFileHelp = `Payload files:
  - Use JSON by default, or YAML when the file ends with .yaml or .yml.
  - Start from files in examples/ when creating tools, MCP servers, skills, agents, or hooks.
  - Register/update commands may open a local confirmation dialog before mutating gateway state.`;
