import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "node:fs/promises";

const client = new Anthropic();

const skill = await client.skills.create({
  files: [
    await toFile(
      await fs.readFile("skills/weather-summary/SKILL.md"),
      "weather-summary/SKILL.md"   // path inside the skill: folder/file
    ),
  ],
});

console.log("✅ Skill uploaded! ID:", skill.id);