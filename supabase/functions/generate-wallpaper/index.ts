import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { companionId, prompt, companionName } = await req.json();

    if (!prompt || !companionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: companionId, prompt" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "Image generation not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enhancedPrompt = `A beautiful, atmospheric background wallpaper for a chat interface. ${prompt}. Wide landscape orientation, photorealistic, cinematic lighting, high quality, no text, no people, no faces, suitable as a background image.`;

    const dalleResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        response_format: "url",
      }),
    });

    if (!dalleResponse.ok) {
      const err = await dalleResponse.json();
      throw new Error(err.error?.message ?? "Image generation failed");
    }

    const dalleData = await dalleResponse.json();
    const tempImageUrl = dalleData.data?.[0]?.url;

    if (!tempImageUrl) {
      throw new Error("No image URL returned from generation");
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser(
      authHeader?.replace("Bearer ", "") ?? ""
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageResponse = await fetch(tempImageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const storagePath = `wallpapers/${user.id}/${companionId}/ai-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("chat-wallpapers")
      .upload(storagePath, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("chat-wallpapers")
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({ imageUrl: urlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
