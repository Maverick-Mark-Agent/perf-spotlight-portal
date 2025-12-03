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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { connection_id } = await req.json();

    // Get the connection with access token
    const { data: connection, error: connError } = await supabaseAdmin
      .from("plaid_connections")
      .select("*, plaid_accounts(*)")
      .eq("id", connection_id)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    const plaidBaseUrl = PLAID_ENV === "production"
      ? "https://production.plaid.com"
      : PLAID_ENV === "development"
        ? "https://development.plaid.com"
        : "https://sandbox.plaid.com";

    // Use transactions/sync for incremental updates
    let hasMore = true;
    let cursor = connection.cursor;
    let added: any[] = [];
    let modified: any[] = [];
    let removed: any[] = [];

    while (hasMore) {
      const syncBody: any = {
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: connection.access_token,
      };

      if (cursor) {
        syncBody.cursor = cursor;
      }

      const syncResponse = await fetch(`${plaidBaseUrl}/transactions/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncBody),
      });

      const syncData = await syncResponse.json();

      if (syncData.error_code) {
        // Handle specific errors
        if (syncData.error_code === "ITEM_LOGIN_REQUIRED") {
          await supabaseAdmin
            .from("plaid_connections")
            .update({
              status: "pending_reauth",
              error_code: syncData.error_code,
              error_message: syncData.error_message,
            })
            .eq("id", connection_id);

          throw new Error("Bank connection needs re-authentication");
        }
        throw new Error(syncData.error_message || "Failed to sync transactions");
      }

      added = added.concat(syncData.added || []);
      modified = modified.concat(syncData.modified || []);
      removed = removed.concat(syncData.removed || []);

      hasMore = syncData.has_more;
      cursor = syncData.next_cursor;
    }

    // Create account ID mapping
    const accountMap = new Map(
      connection.plaid_accounts.map((acc: any) => [acc.account_id, acc.id])
    );

    // Process added transactions
    if (added.length > 0) {
      const transactionsToInsert = added.map((tx: any) => ({
        account_id: accountMap.get(tx.account_id),
        transaction_id: tx.transaction_id,
        amount: tx.amount, // Plaid: positive = money out
        date: tx.date,
        datetime: tx.datetime,
        name: tx.name,
        merchant_name: tx.merchant_name,
        merchant_entity_id: tx.merchant_entity_id,
        plaid_category: tx.category,
        plaid_category_id: tx.category_id,
        personal_finance_category: tx.personal_finance_category?.primary,
        is_pending: tx.pending,
        payment_channel: tx.payment_channel,
        transaction_type: tx.transaction_type,
        status: "pending",
      })).filter((tx: any) => tx.account_id); // Only insert if we have the account

      if (transactionsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from("bank_transactions")
          .upsert(transactionsToInsert, {
            onConflict: "transaction_id",
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error("Error inserting transactions:", insertError);
        }
      }
    }

    // Process modified transactions
    for (const tx of modified) {
      await supabaseAdmin
        .from("bank_transactions")
        .update({
          amount: tx.amount,
          name: tx.name,
          merchant_name: tx.merchant_name,
          is_pending: tx.pending,
        })
        .eq("transaction_id", tx.transaction_id);
    }

    // Process removed transactions
    if (removed.length > 0) {
      const removedIds = removed.map((r: any) => r.transaction_id);
      await supabaseAdmin
        .from("bank_transactions")
        .delete()
        .in("transaction_id", removedIds);
    }

    // Update connection cursor and last sync time
    await supabaseAdmin
      .from("plaid_connections")
      .update({
        cursor: cursor,
        last_synced_at: new Date().toISOString(),
        status: "active",
        error_code: null,
        error_message: null,
      })
      .eq("id", connection_id);

    // Also update account balances
    const balancesResponse = await fetch(`${plaidBaseUrl}/accounts/balance/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: connection.access_token,
      }),
    });

    const balancesData = await balancesResponse.json();
    if (!balancesData.error_code) {
      for (const acc of balancesData.accounts) {
        await supabaseAdmin
          .from("plaid_accounts")
          .update({
            current_balance: acc.balances?.current,
            available_balance: acc.balances?.available,
            last_balance_update: new Date().toISOString(),
          })
          .eq("account_id", acc.account_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: added.length,
        modified: modified.length,
        removed: removed.length,
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
