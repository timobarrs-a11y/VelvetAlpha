import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HealthCheckResult {
  timestamp: string;
  database_healthy: boolean;
  auth_healthy: boolean;
  api_latency_ms: number;
  overall_status: "healthy" | "degraded" | "down";
}

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/user_profiles?limit=0`,
      {
        headers: {
          "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function checkAuthHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/settings`,
      {
        headers: {
          "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function logHealthCheck(result: HealthCheckResult) {
  try {
    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/monitoring_logs`,
      {
        method: "POST",
        headers: {
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          check_type: "uptime",
          status: result.overall_status,
          details: {
            database_healthy: result.database_healthy,
            auth_healthy: result.auth_healthy,
            api_latency_ms: result.api_latency_ms,
          },
        }),
      }
    );
  } catch (error) {
    console.error("Failed to log health check:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const startTime = Date.now();

    const [dbHealthy, authHealthy] = await Promise.all([
      checkDatabaseHealth(),
      checkAuthHealth(),
    ]);

    const latency = Date.now() - startTime;

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      database_healthy: dbHealthy,
      auth_healthy: authHealthy,
      api_latency_ms: latency,
      overall_status:
        dbHealthy && authHealthy ? "healthy" : "degraded",
    };

    await logHealthCheck(result);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Health check error:", error);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        overall_status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
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
