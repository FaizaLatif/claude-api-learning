import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-haiku-5-5",
  max_tokens: 4096,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  messages: [
    { role: "user", content: "Should I expect heavy rain in Lourinhã today?" },
  ],
});

for (const block of response.content) {
  console.log(block.type);
  if (block.type === "text") console.log(block.text);
}
console.log("stop_reason:", response.stop_reason);
console.log(response.usage);