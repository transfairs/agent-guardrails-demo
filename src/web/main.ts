import { runAgent, type AgentEvent } from "../agent.js";
import { PolicyMockClient } from "../mockClient.js";
import { makeRefundLimitHook } from "../tools.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const order = $<HTMLSelectElement>("order");
const amount = $<HTMLInputElement>("amount");
const limit = $<HTMLInputElement>("limit");
const runBtn = $<HTMLButtonElement>("run");
const timeline = $<HTMLOListElement>("timeline");

const sync = () => {
  $("amountOut").textContent = amount.value;
  $("limitOut").textContent = limit.value;
};
[amount, limit].forEach((el) => el.addEventListener("input", sync));
sync();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (v: unknown) => JSON.stringify(v, null, 1);

function add(e: AgentEvent) {
  const li = document.createElement("li");
  const label = document.createElement("small");
  const body = document.createElement("pre");
  li.className = e.kind;
  switch (e.kind) {
    case "user": label.textContent = "User"; body.textContent = e.text; break;
    case "tool_call": label.textContent = "Claude calls tool"; body.textContent = `${e.name}(${fmt(e.input)})`; break;
    case "blocked": label.textContent = "Hook blocked the call"; body.textContent = `${e.name}: ${e.reason}`; break;
    case "tool_result":
      label.textContent = "Tool result"; body.textContent = fmt(e.output);
      if (e.name === "escalate_to_human") li.classList.add("escalated");
      break;
    case "final": label.textContent = `Claude answers (${e.turns} turns, stop_reason: end_turn)`; body.textContent = e.text; break;
  }
  li.append(label, body);
  timeline.append(li);
}

runBtn.addEventListener("click", async () => {
  runBtn.disabled = true;
  timeline.replaceChildren();
  const amt = Number(amount.value);
  const client = new PolicyMockClient(order.value, amt);
  const events: AgentEvent[] = [];
  await runAgent(client, `Please refund order ${order.value} (${amt} EUR).`, [makeRefundLimitHook(Number(limit.value))], (e) => events.push(e));
  for (const e of events) { add(e); await sleep(450); }
  runBtn.disabled = false;
});
