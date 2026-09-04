import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

interface AnalyzeRequest {
  messages: Message[];
  companionId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, companionId }: AnalyzeRequest = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const conversationText = messages
      .slice(-50)
      .map((m) => `${m.role === "user" ? "User" : "Companion"}: ${m.content}`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 2000,
      tools: [
        {
          name: "conversation_analysis",
          description: "Structured analysis of a conversation between a user and their AI companion",
          input_schema: {
            type: "object" as const,
            properties: {
              topics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    relevance: { type: "number", description: "0 to 1" },
                    category: {
                      type: "string",
                      enum: ["career", "relationships", "health", "creativity", "goals", "emotions", "daily_life", "entertainment", "learning", "personal_growth"],
                    },
                  },
                  required: ["name", "relevance", "category"],
                },
              },
              sentiment: {
                type: "object",
                properties: {
                  overall: { type: "number", description: "-1 to 1" },
                  trajectory: { type: "string", enum: ["improving", "stable", "declining"] },
                  emotions: { type: "array", items: { type: "string" } },
                },
                required: ["overall", "trajectory", "emotions"],
              },
              goals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    goal: { type: "string" },
                    mentioned_at: { type: "string" },
                    status: { type: "string", enum: ["active", "completed", "abandoned"] },
                    progress: { type: "number", description: "0 to 100" },
                  },
                  required: ["goal", "mentioned_at", "status"],
                },
              },
              facts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    fact: { type: "string" },
                    category: { type: "string" },
                    confidence: { type: "number", description: "0 to 1" },
                  },
                  required: ["fact", "category", "confidence"],
                },
              },
              relationshipHealth: {
                type: "object",
                properties: {
                  score: { type: "number", description: "0 to 100" },
                  factors: {
                    type: "object",
                    properties: {
                      communication: { type: "number" },
                      emotional_support: { type: "number" },
                      engagement: { type: "number" },
                      consistency: { type: "number" },
                    },
                    required: ["communication", "emotional_support", "engagement", "consistency"],
                  },
                  insights: { type: "array", items: { type: "string" } },
                },
                required: ["score", "factors", "insights"],
              },
              personalizedInsights: {
                type: "array",
                items: { type: "string" },
                description: "3-5 actionable insights about the user's patterns, growth, or needs",
              },
              communicationPatterns: {
                type: "object",
                properties: {
                  responseTime: { type: "string", enum: ["immediate", "quick", "moderate", "slow"] },
                  conversationInitiator: { type: "string", enum: ["user", "companion", "balanced"] },
                  topicDepth: { type: "string", enum: ["shallow", "moderate", "deep"] },
                  vulnerabilityLevel: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["responseTime", "conversationInitiator", "topicDepth", "vulnerabilityLevel"],
              },
            },
            required: ["topics", "sentiment", "goals", "facts", "relationshipHealth", "personalizedInsights", "communicationPatterns"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "conversation_analysis" },
      messages: [
        {
          role: "user",
          content: `Analyze this conversation between a user and their AI companion (companionId: ${companionId}). Extract topics, sentiment, goals, facts about the user, relationship health score, personalized insights, and communication patterns.\n\nConversation:\n${conversationText}`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use result in response");
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-conversation:", error);
    return new Response(
      JSON.stringify({
        topics: [{ name: "general", relevance: 0.5, category: "daily_life" }],
        sentiment: { overall: 0, trajectory: "stable", emotions: [] },
        goals: [],
        facts: [],
        relationshipHealth: {
          score: 50,
          factors: { communication: 50, emotional_support: 50, engagement: 50, consistency: 50 },
          insights: ["Keep chatting to build your relationship health score"],
        },
        personalizedInsights: ["Continue having conversations to generate insights"],
        communicationPatterns: {
          responseTime: "moderate",
          conversationInitiator: "balanced",
          topicDepth: "moderate",
          vulnerabilityLevel: "medium",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
