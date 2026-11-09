// Lesson 01: Hello, Claude
// Run with: npx tsx lessons/01-hello.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const buggyCode = `
function add(a, b) {
  return a - b;
}
`;

const response = await client.messages.create({
  // Claude Fable => claude Opus => Claude Sonnet => Claude Haiku
  model: "claude-haiku-5-5",
  max_tokens: 2048,
  //shape behaviour
  system: "You are a terse senior code reviewer. Give feedback in one paragraph.",
  messages: [
    { role: "user", content: `Review this code:\n${buggyCode}` },
  ],
});

for (const block of response.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
  console.log(response.usage);
