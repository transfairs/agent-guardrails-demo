import type { ClaudeClient, Message, Response } from "./types.js";

/** Replays a fixed list of responses in order, one per `create` call. */
export class MockClient implements ClaudeClient {
  private i = 0;
  constructor(private script: Response[]) {}
  async create(_messages: Message[]): Promise<Response> {
    const r = this.script[this.i++];
    if (!r) throw new Error("mock script exhausted");
    return r;
  }
}

/** Builds a `tool_use` response. */
export const use = (id: string, name: string, input: Record<string, unknown>): Response => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input }],
});
/** Builds a final text response. */
export const say = (text: string): Response => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

/**
 * Rule-based stand-in for the model: looks up the order, attempts the refund, and escalates if the hook denied it.
 * Unlike `MockClient` it reacts to the conversation, so the web demo responds to changed inputs.
 */
export class PolicyMockClient implements ClaudeClient {
  constructor(private orderId: string, private amount: number) {}
  async create(messages: Message[]): Promise<Response> {
    const results = messages.flatMap((m) => (m.role === "user" && typeof m.content !== "string" ? m.content : []));
    const calls = messages.flatMap((m) => (m.role === "assistant" ? m.content.filter((b) => b.type === "tool_use") : []));
    const n = calls.length;
    const last = results[results.length - 1];
    if (n === 0) return use("t1", "lookup_order", { order_id: this.orderId });
    if (n === 1) return use("t2", "issue_refund", { order_id: this.orderId, amount: this.amount });
    if (n === 2 && last?.is_error)
      return use("t3", "escalate_to_human", { summary: `Refund ${this.amount} EUR for ${this.orderId} needs approval` });
    if (last?.is_error) return say("I could not complete this.");
    return say(
      calls.some((c) => c.name === "escalate_to_human")
        ? "This refund needs human approval. I opened ticket T-4711."
        : `Done, ${this.amount} EUR refunded for ${this.orderId}.`,
    );
  }
}
