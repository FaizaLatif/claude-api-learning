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
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";


const client = new Anthropic();

const tools = [
  betaZodTool({
    name: "get_weather",
    description: "Get the CURRENT weather for a city. For future days, use get_forecast.",
    inputSchema: z.object({
      city: z.string().describe("City name, e.g. Paris"),
    }),
    run: async ({ city }) => getWeather(city),
  }),
  betaZodTool({
    name: "get_forecast",
    description: "Get the daily forecast for a city for the next 1–16 days.",
    inputSchema: z.object({
      city: z.string().describe("City name, e.g. Paris"),
      days: z.number().int().min(1).max(16).describe("Number of days to forecast"),
    }),
    run: async ({ city, days }) => getForecast(city, days),
  }),
];


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

  const finalMessage = await client.beta.messages.toolRunner({
  model: "claude-haiku-5-5",
  max_tokens: 2048,
  tools,
  messages: [{ role: "user", content: "How's the weather this week in Denver?" }],
});

for (const block of finalMessage.content) {
  if (block.type === "text") console.log(block.text);
}