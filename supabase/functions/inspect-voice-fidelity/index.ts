import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InspectRequest {
  // The intended voice — the frozen "golden fingerprint".
  voiceInstruction: string;
  voiceExamples?: string[];
  // The companion's recent assistant messages (most recent last).
  recentMessages: string[];
  companionId: string;
}

// A neutral, mid-band result used whenever inspection can't run, so a failure
// never triggers a false "drift" correction.
function neutralResult(sampled: number) {
  return {
    scores: {
      tone: 0.85,
      vocabulary: 0.85,
      emotional: 0.85,
      energy: 0.85,
      boundary: 0.85,
    },
    overall: 0.85,
    drift_detected: false,
    notes: "inspection unavailable — neutral score returned",
    messages_sampled: sampled,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let sampled = 0;
  try {
    const { voiceInstruction, voiceExamples, recentMessages, companionId }: InspectRequest =
      await req.json();

    if (!recentMessages || !Array.isArray(recentMessages) || recentMessages.length === 0) {
      return new Response(JSON.stringify(neutralResult(0)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    sampled = recentMessages.length;

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const messagesBlock = recentMessages
      .slice(-15)
      .map((m, i) => `${i + 1}. ${m}`)
      .join("\n");

    const examplesBlock =
      voiceExamples && voiceExamples.length > 0
        ? `\n\nCANONICAL VOICE EXAMPLES (how this voice is supposed to sound):\n${voiceExamples
            .map((e) => `- ${e}`)
            .join("\n")}`
        : "";

    const prompt = `You are auditing an AI companion for personality/voice drift.

INTENDED VOICE (the baseline this companion must match):
${voiceInstruction}${examplesBlock}

THE COMPANION'S RECENT MESSAGES (companionId: ${companionId}):
${messagesBlock}

Score how closely the recent messages match the INTENDED VOICE on each dimension,
from 0.0 (completely off-voice) to 1.0 (perfectly on-voice). Be strict and honest —
a subtle flattening of tone or loss of characteristic vocabulary should lower the score.`;

    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 1000,
      tools: [
        {
          name: "voice_fidelity_report",
          description: "Structured scoring of how closely a companion's recent messages match its intended signature voice",
          input_schema: {
            type: "object" as const,
            properties: {
              scores: {
                type: "object",
                properties: {
                  tone: { type: "number", description: "0-1: does the language feel like this voice?" },
                  vocabulary: { type: "number", description: "0-1: are the voice's characteristic words/phrases present?" },
                  emotional: { type: "number", description: "0-1: are feelings handled the way this voice would?" },
                  energy: { type: "number", description: "0-1: do length and enthusiasm match this voice?" },
                  boundary: { type: "number", description: "0-1: staying inside the voice's defined relationship style?" },
                },
                required: ["tone", "vocabulary", "emotional", "energy", "boundary"],
              },
              overall: { type: "number", description: "0-1: weighted overall fidelity score" },
              drift_detected: { type: "boolean", description: "true if the companion has meaningfully drifted from its voice" },
              notes: { type: "string", description: "one short sentence explaining the main drift, or empty if on-voice" },
            },
            required: ["scores", "overall", "drift_detected", "notes"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "voice_fidelity_report" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use result in response");
    }

    const result = { ...(toolUse.input as Record<string, unknown>), messages_sampled: sampled };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in inspect-voice-fidelity:", error);
    return new Response(JSON.stringify(neutralResult(sampled)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
