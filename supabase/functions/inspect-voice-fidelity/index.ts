import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NEUTRAL_SCORE = {
  scores: { tone: 0.85, vocabulary: 0.85, emotional: 0.85, energy: 0.85, boundary: 0.85 },
  overall: 0.85,
  drift_detected: false,
  notes: "",
};

interface InspectRequest {
  voiceInstruction: string;
  voiceExamples: string[];
  recentMessages: { role: string; content: string }[];
  companionId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { voiceInstruction, voiceExamples, recentMessages, companionId }: InspectRequest =
      await req.json();

    if (!recentMessages || recentMessages.length === 0) {
      return new Response(JSON.stringify(NEUTRAL_SCORE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const examplesText =
      voiceExamples && voiceExamples.length > 0
        ? `\n\nVoice examples (baseline):\n${voiceExamples.map((e, i) => `${i + 1}. "${e}"`).join("\n")}`
        : "";

    const messagesText = recentMessages
      .filter((m) => m.role === "assistant")
      .slice(-20)
      .map((m) => `- "${m.content}"`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 1024,
      tools: [
        {
          name: "voice_fidelity_report",
          description:
            "Score how faithfully a companion's recent messages match its defined voice/personality instruction",
          input_schema: {
            type: "object" as const,
            properties: {
              scores: {
                type: "object",
                description: "Per-dimension fidelity scores, each 0 (total drift) to 1 (perfect match)",
                properties: {
                  tone: {
                    type: "number",
                    description: "Tone/mood alignment (warm, sarcastic, formal, etc.)",
                  },
                  vocabulary: {
                    type: "number",
                    description: "Word choice, slang, register match",
                  },
                  emotional: {
                    type: "number",
                    description: "Emotional expression style match",
                  },
                  energy: {
                    type: "number",
                    description: "Energy/pace alignment (upbeat, calm, intense, etc.)",
                  },
                  boundary: {
                    type: "number",
                    description:
                      "Appropriate personal boundary maintenance as defined by voice instruction",
                  },
                },
                required: ["tone", "vocabulary", "emotional", "energy", "boundary"],
              },
              overall: {
                type: "number",
                description: "Weighted overall fidelity score 0–1",
              },
              drift_detected: {
                type: "boolean",
                description: "True if overall < 0.70 or any dimension < 0.55",
              },
              notes: {
                type: "string",
                description:
                  "Brief human-readable note on what drifted and why, or empty string if no drift",
              },
            },
            required: ["scores", "overall", "drift_detected", "notes"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "voice_fidelity_report" },
      messages: [
        {
          role: "user",
          content: `You are evaluating voice fidelity for companion ID: ${companionId}.

Voice instruction:
"${voiceInstruction}"${examplesText}

Recent companion messages to evaluate:
${messagesText}

Score how well the recent messages match the voice instruction across the five dimensions. Set drift_detected = true if overall < 0.70 or any single dimension < 0.55.`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return new Response(JSON.stringify(NEUTRAL_SCORE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in inspect-voice-fidelity:", error);
    return new Response(JSON.stringify(NEUTRAL_SCORE), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
