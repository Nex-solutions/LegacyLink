import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { supabase } from "./integrations/supabase/client";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Attach the Supabase access token to every server-fn call on the client so
// requireSupabaseAuth middleware can authenticate the request.
const supabaseAuthClientMiddleware = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers = { Authorization: `Bearer ${token}` };
      } catch {
        // ignore — request will proceed unauthenticated
      }
    }
    return next({ headers });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [supabaseAuthClientMiddleware],
}));
