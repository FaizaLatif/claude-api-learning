// Lesson: Agent loop with a weather tool
// Run with: npx tsx lessons/Weather_agent_loop.ts
//
// The agent loop:
//   1. Send the conversation + tool definitions to Claude.
//   2. If Claude asks to use a tool (stop_reason "tool_use"), run it ourselves.
//   3. Send the tool results back and repeat until Claude gives a final answer.
/* Tu ──pergunta + ferramentas──▶ Claude
Tu ◀── "preciso que corras get_weather('Lisbon')" ── Claude
Tu: corres a função, obténs 18°C
Tu ──resultado──▶ Claude
Tu ◀──resposta final── Claude */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools: Anthropic.ToolUnion[] = [
  // Required for skills: they run inside Claude's code execution sandbox.
  { type: "code_execution_20260521", name: "code_execution" },
  {
    name: "get_weather",
    description:
      "Get the current weather for a city. Returns temperature and conditions.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Paris" },
      },
      required: ["city"],
      additionalProperties: false,
    },
  },
    {
    name: "get_forecast",
    description:
      "Get the weather forecast for a city. Returns temperature and conditions.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Paris" },
        days: { type: "number", description: "Number of days to forecast, e.g. 3" },
      },
      required: ["city", "days"],
      additionalProperties: false,
    },
  },
];

function runTool(name: string, input: unknown): Promise<string> {
 const args = input as { city: string; days: number };
 switch (name) {
    case "get_weather":
      return getWeather(args.city);
    case "get_forecast":
      return getForecast(args.city, args.days);
    default:
      throw new Error(`Unknown tool: ${name}`); 
  }

}
async function getCoordinates(city: string) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  ).then((r) => r.json());

  return geo.results?.[0];   // undefined se não encontrar
}
async function getForecast(city: string, days: number): Promise<string> {
  const place = await getCoordinates(city);
  if (!place) return `City not found: ${city}`;

  const forecast = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
      `&forecast_days=${days}&timezone=auto`
  ).then((r) => r.json());

  return JSON.stringify({ city: place.name, country: place.country, daily: forecast.daily });
}

//What runs when clause asks for the tool
async function getWeather(city: string): Promise<string> {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  ).then((r) => r.json());

  const place = geo.results?.[0];
  if (!place) return `City not found: ${city}`;

  const weather = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,precipitation,wind_speed_10m`
  ).then((r) => r.json());

  return JSON.stringify({ city: place.name, country: place.country, ...weather.current });
}
  //ASK once
  const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "How's the weather this week in Denver?" },
  ];


let containerId: string | undefined;   // reuse the same sandbox on every turn

while (true) {

  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 2048,
    container: {
    ...(containerId ? { id: containerId } : {}),
    skills: [
      { type: "custom", skill_id: "skill_014hAptmjs9wLJaaGqAUQj55", version: "latest" },
    ],
  },
    thinking: { type: "adaptive", display: "summarized" },
    tools,
    messages,
  });
messages.push({ role: "assistant", content: response.content});   // o que o Claude pediu
containerId = response.container?.id ?? containerId;

// Server tools (code execution) can pause a long turn: send it back to continue.
if (response.stop_reason === "pause_turn") continue;

if (response.stop_reason !== "tool_use") {
  for (const block of response.content) {
      if (block.type === "thinking") console.log("💭 THINKING:\n", block.thinking);

    if (block.type === "text") console.log(block.text);
  }
  break;
}

// 1. Correr as ferramentas que o Claude pediu
const results: Anthropic.ToolResultBlockParam[] = [];

for (const block of response.content) {
  if (block.type === "tool_use") {
    
     const result = await runTool(block.name, block.input);
    console.log(`🔧 ${block.name}:`, result);


    results.push({
      type: "tool_result",
      tool_use_id: block.id,   // ← o "número do pedido"
      content: result,
    });
  }
}
messages.push({ role: "user", content: results });   // o que o Claude pediu





}