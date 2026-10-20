import type { PreToolHook } from "./types.js";

const ORDERS: Record<string, { customer: string; total: number }> = {
  "A-1001": { customer: "Mia", total: 49.9 },
  "A-2002": { customer: "Jonas", total: 899.0 },
};

/** Tool definitions in the format expected by the Messages API `tools` parameter. */
export const toolSchemas = [
  { name: "lookup_order", description: "Look up an order by id", input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] } },
  { name: "issue_refund", description: "Refund an order (amount in EUR)", input_schema: { type: "object", properties: { order_id: { type: "string" }, amount: { type: "number" } }, required: ["order_id", "amount"] } },
  { name: "escalate_to_human", description: "Hand the case to a human agent", input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] } },
];

/** Stub implementations keyed by tool name, standing in for real backend calls. */
export const toolImpls: Record<string, (input: any) => unknown> = {
  lookup_order: ({ order_id }) => ORDERS[order_id] ?? { error: `unknown order ${order_id}` },
  issue_refund: ({ order_id, amount }) => ({ status: "refunded", order_id, amount }),
  escalate_to_human: ({ summary }) => ({ status: "escalated", ticket: "T-4711", summary }),
};

/** Default refund ceiling in EUR above which a human must approve. */
export const REFUND_LIMIT_EUR = 100;
/**
 * Builds a hook that denies `issue_refund` calls above `limit`.
 * Enforcing the policy in code is deterministic; a prompt instruction alone can be ignored by the model.
 */
export const makeRefundLimitHook = (limit: number): PreToolHook => (call) => {
  if (call.name === "issue_refund" && Number(call.input.amount) > limit) {
    return { allow: false, reason: `Refund above ${limit} EUR requires human approval. Use escalate_to_human.` };
  }
  return { allow: true };
};
export const refundLimitHook = makeRefundLimitHook(REFUND_LIMIT_EUR);
