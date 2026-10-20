/** Content block and message shapes mirror the Anthropic Messages API, so a real SDK client can replace the mock unchanged. */
export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type ContentBlock = TextBlock | ToolUseBlock;

export type Message =
  | { role: "user"; content: string | ToolResultBlock[] }
  | { role: "assistant"; content: ContentBlock[] };

export type Response = { stop_reason: "end_turn" | "tool_use"; content: ContentBlock[] };

/** Minimal surface of the Messages API that the agent loop depends on. */
export interface ClaudeClient {
  create(messages: Message[]): Promise<Response>;
}

/** Verdict of a pre-tool hook; a denial carries a reason that is fed back to the model. */
export type HookDecision = { allow: true } | { allow: false; reason: string };
export type PreToolHook = (call: ToolUseBlock) => HookDecision;
