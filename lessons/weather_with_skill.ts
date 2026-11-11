// Lesson: Using a custom skill to control the output format
// First run lessons/upload_weather_skill.ts once, then:
// Run with: npx tsx --env-file=.env lessons/weather_with_skill.ts
//
// The skill (skills/weather-summary/SKILL.md) tells Claude HOW to answer.
// Web search gives Claude the actual weather data.
// Skills run inside the code execution container, so that tool is required.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Find the skill we uploaded, by name.
let skillId: string | undefined;
for await (const skill of client.skills.list()) {
  if (skill.display_name === "weather-summary") skillId = skill.id;
}
if (!skillId) throw new Error("Skill not found: run lessons/upload_weather_skill.ts first.");

const messages: Anthropic.Beta.BetaMessageParam[] = [
  { role: "user", content: "I'm going to Denver for 3 days starting tomorrow. What's the weather going to be like?" },
];

let containerId: string | undefined;

// Server tools can pause a long turn (stop_reason "pause_turn"); we just send it back to continue.
for (let turn = 1; turn <= 5; turn++) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    container: {
      ...(containerId ? { id: containerId } : {}),
      skills: [{ type: "custom", skill_id: skillId, version: "latest" }],
    },
    tools: [
      { type: "code_execution_20260521", name: "code_execution" },
      { type: "web_search_20250305", name: "web_search", max_uses: 3 },
    ],
    // If Claude declines a request, the API retries it on a fallback model.
    betas: ["code-execution-2025-08-25", "server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages,
  });

  containerId = response.container?.id;

  if (response.stop_reason === "pause_turn") {
    messages.push({ role: "assistant", content: response.content });
    continue;
  }

  if (response.stop_reason === "refusal") {
    console.log("Claude declined:", response.stop_details?.explanation);
  } else {
    for (const block of response.content) {
      if (block.type === "text") process.stdout.write(block.text);
    }
    console.log("\n");
  }
  console.log("stop_reason:", response.stop_reason);
  console.log(response.usage);
  break;
}
