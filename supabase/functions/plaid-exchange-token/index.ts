import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_ENV = Deno.env.get("PLAID_ENV") || "sandbox";

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      throw new Error("Plaid credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { public_token, institution } = await req.json();
    if (!public_token) {
      throw new Error("public_token is required");
    }

    const plaidBaseUrl = PLAID_ENV === "production"
      ? "https://production.plaid.com"
      : PLAID_ENV === "development"
        ? "https://development.plaid.com"
        : "https://sandbox.plaid.com";

    // Exchange public token for access token
    const exchangeResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: public_token,
      }),
    });

    const exchangeData = await exchangeResponse.json();

    if (exchangeData.error_code) {
      console.error("Plaid exchange error:", exchangeData);
      throw new Error(exchangeData.error_message || "Failed to exchange token");
    }

    const { access_token, item_id } = exchangeData;

    // Save connection to database
    const { data: connection, error: connError } = await supabaseAdmin
      .from("plaid_connections")
      .insert({
        user_id: user.id,
        item_id: item_id,
        access_token: access_token, // In production, encrypt this
        institution_id: institution?.institution_id,
        institution_name: institution?.name,
        status: "active",
      })
      .select()
      .single();

    if (connError) {
      console.error("Database error:", connError);
      throw new Error("Failed to save connection");
    }

    // Fetch accounts for this connection
    const accountsResponse = await fetch(`${plaidBaseUrl}/accounts/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: access_token,
      }),
    });

    const accountsData = await accountsResponse.json();

    if (accountsData.error_code) {
      console.error("Plaid accounts error:", accountsData);
    } else {
      // Save accounts
      const accountsToInsert = accountsData.accounts.map((acc: any) => ({
        connection_id: connection.id,
        account_id: acc.account_id,
        name: acc.name,
        official_name: acc.official_name,
        type: acc.type,
        subtype: acc.subtype,
        mask: acc.mask,
        current_balance: acc.balances?.current,
        available_balance: acc.balances?.available,
        currency_code: acc.balances?.iso_currency_code || "USD",
        is_active: true,
        last_balance_update: new Date().toISOString(),
      }));

      const { error: accError } = await supabaseAdmin
        .from("plaid_accounts")
        .insert(accountsToInsert);

      if (accError) {
        console.error("Error saving accounts:", accError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        connection_id: connection.id,
        institution_name: institution?.name,
        accounts_count: accountsData.accounts?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
