import type { ClaudeClient, Message, PreToolHook, ToolResultBlock, ToolUseBlock } from "./types.js";
import { toolImpls } from "./tools.js";

/** Observable steps of one agent run, emitted so a UI or logger can render the loop. */
export type AgentEvent =
  | { kind: "user"; text: string }
  | { kind: "tool_call"; name: string; input: Record<string, unknown> }
  | { kind: "blocked"; name: string; reason: string }
  | { kind: "tool_result"; name: string; output: unknown }
  | { kind: "final"; text: string; turns: number };

/**
 * Runs the agentic loop until the model ends its turn.
 * Each tool call passes through every pre-tool hook first; a denial is returned to the model as an error
 * `tool_result` so it can adapt (for example by escalating) instead of failing the run.
 *
 * @throws if the model has not finished after `maxTurns` iterations.
 */
export async function runAgent(
  client: ClaudeClient,
  userInput: string,
  hooks: PreToolHook[],
  onEvent: (e: AgentEvent) => void = () => {},
  maxTurns = 8,
) {
  onEvent({ kind: "user", text: userInput });
  const messages: Message[] = [{ role: "user", content: userInput }];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const res = await client.create(messages);
    messages.push({ role: "assistant", content: res.content });

    // Branch on stop_reason rather than parsing the reply text, which is fragile.
    if (res.stop_reason === "end_turn") {
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      onEvent({ kind: "final", text, turns: turn });
      return { text, turns: turn };
    }

    const results: ToolResultBlock[] = res.content
      .filter((b): b is ToolUseBlock => b.type === "tool_use")
      .map((call) => {
        onEvent({ kind: "tool_call", name: call.name, input: call.input });
        const verdict = hooks.map((h) => h(call)).find((d) => !d.allow);
        if (verdict && !verdict.allow) {
          onEvent({ kind: "blocked", name: call.name, reason: verdict.reason });
          return { type: "tool_result", tool_use_id: call.id, content: verdict.reason, is_error: true };
        }
        const out = toolImpls[call.name]?.(call.input);
        onEvent({ kind: "tool_result", name: call.name, output: out });
        return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out) };
      });
    messages.push({ role: "user", content: results });
  }
  throw new Error("max turns exceeded");
}
