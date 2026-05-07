#!/usr/bin/env node
import { Command } from "commander";
import { agentCommand } from "./commands/agent.js";
import { chatCommand } from "./commands/chat.js";
import { configCommand } from "./commands/config.js";
import { skillCommand } from "./commands/skill.js";

const program = new Command();

program
  .name("agentctl")
  .description("CLI for agent-gateway")
  .version("0.1.0")
  .addCommand(configCommand())
  .addCommand(skillCommand())
  .addCommand(agentCommand())
  .addCommand(chatCommand());

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
