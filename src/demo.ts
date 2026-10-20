import { runAgent } from "./agent.js";
import { MockClient, say, use } from "./mockClient.js";
import { refundLimitHook } from "./tools.js";

async function scenario(title: string, input: string, script: ConstructorParameters<typeof MockClient>[0]) {
  console.log(`\n=== ${title} ===\nUser: ${input}`);
  await runAgent(new MockClient(script), input, [refundLimitHook], (e) => {
    if (e.kind === "tool_call") console.log(`  [tool] ${e.name}(${JSON.stringify(e.input)})`);
    if (e.kind === "blocked") console.log(`  [hook] BLOCKED ${e.name}: ${e.reason}`);
    if (e.kind === "tool_result") console.log(`  [result] ${JSON.stringify(e.output)}`);
    if (e.kind === "final") console.log(`Agent (${e.turns} turns): ${e.text}`);
  });
}

await scenario("Small refund: auto-approved", "Please refund order A-1001 (49.90 EUR).", [
  use("t1", "lookup_order", { order_id: "A-1001" }),
  use("t2", "issue_refund", { order_id: "A-1001", amount: 49.9 }),
  say("Done, 49.90 EUR refunded for A-1001."),
]);

await scenario("Large refund: hook blocks, agent escalates", "Refund order A-2002 (899 EUR), it arrived broken.", [
  use("t1", "lookup_order", { order_id: "A-2002" }),
  use("t2", "issue_refund", { order_id: "A-2002", amount: 899 }),
  use("t3", "escalate_to_human", { summary: "Refund 899 EUR for A-2002 exceeds limit" }),
  say("This refund needs human approval. I opened ticket T-4711."),
]);
