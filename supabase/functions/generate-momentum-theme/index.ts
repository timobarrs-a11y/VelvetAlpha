import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ThemeRequest {
  theme: string;
}

interface ThemeResponse {
  levelName: string;
  background: [string, string];
  playerColor: string;
  playerGlow: string;
  boostTrailColor: string;
  platforms: string[];
  glows: string[];
  checkpoint: string;
  checkpointGlow: string;
  flavorText: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { theme }: ThemeRequest = await req.json();

    if (!theme) {
      return new Response(
        JSON.stringify({ error: "Theme is required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const prompt = `Generate a color theme for: "${theme}"

Return ONLY valid JSON, no markdown:
{
  "levelName": "creative 2-4 word name",
  "background": ["#hex1", "#hex2"],
  "playerColor": "#hex",
  "playerGlow": "#hex",
  "boostTrailColor": "#hex (bright/electric)",
  "platforms": ["#hex1", "#hex2", "#hex3"],
  "glows": ["#hex1", "#hex2", "#hex3"],
  "checkpoint": "#hex (distinct, safe color)",
  "checkpointGlow": "#hex",
  "flavorText": "5-8 word atmosphere"
}

Make colors cohesive and atmospheric for the theme.`;

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    const cleaned = text.replace(/```json\n?|```\n?/g, "").trim();
    const themeConfig: ThemeResponse = JSON.parse(cleaned);

    return new Response(JSON.stringify(themeConfig), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error generating theme:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate theme" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});