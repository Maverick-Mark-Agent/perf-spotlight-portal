import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize vendor names for consistent matching
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(inc|llc|co|corp|payment|pymt|ach|debit|charge|transaction)\.?/gi, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface LearnedRule {
  vendor_name: string;
  learned_mapping: { category_id: string };
  confidence_score: number;
}

// Known recurring merchants/patterns
const RECURRING_PATTERNS = [
  // Subscriptions
  { pattern: /netflix/i, name: "Netflix", type: "subscription" },
  { pattern: /spotify/i, name: "Spotify", type: "subscription" },
  { pattern: /hulu/i, name: "Hulu", type: "subscription" },
  { pattern: /amazon prime/i, name: "Amazon Prime", type: "subscription" },
  { pattern: /disney\+|disneyplus/i, name: "Disney+", type: "subscription" },
  { pattern: /apple\s*(music|tv|one|icloud)/i, name: "Apple Services", type: "subscription" },
  { pattern: /youtube\s*(premium|music)/i, name: "YouTube Premium", type: "subscription" },
  { pattern: /hbo\s*max/i, name: "HBO Max", type: "subscription" },
  { pattern: /dropbox/i, name: "Dropbox", type: "subscription" },
  { pattern: /adobe/i, name: "Adobe", type: "subscription" },
  { pattern: /microsoft\s*365|office\s*365/i, name: "Microsoft 365", type: "subscription" },
  { pattern: /zoom/i, name: "Zoom", type: "subscription" },
  { pattern: /slack/i, name: "Slack", type: "subscription" },
  { pattern: /notion/i, name: "Notion", type: "subscription" },
  { pattern: /figma/i, name: "Figma", type: "subscription" },
  { pattern: /canva/i, name: "Canva", type: "subscription" },
  { pattern: /mailchimp/i, name: "Mailchimp", type: "subscription" },
  { pattern: /hubspot/i, name: "HubSpot", type: "subscription" },
  { pattern: /salesforce/i, name: "Salesforce", type: "subscription" },

  // Utilities
  { pattern: /comcast|xfinity/i, name: "Comcast/Xfinity", type: "utility" },
  { pattern: /at&t|att\s/i, name: "AT&T", type: "utility" },
  { pattern: /verizon/i, name: "Verizon", type: "utility" },
  { pattern: /t-mobile|tmobile/i, name: "T-Mobile", type: "utility" },
  { pattern: /pg&e|pge\s/i, name: "PG&E", type: "utility" },
  { pattern: /electric|power\s*co/i, name: "Electric Company", type: "utility" },
  { pattern: /water\s*(dept|district|co)/i, name: "Water Company", type: "utility" },
  { pattern: /gas\s*(co|company)/i, name: "Gas Company", type: "utility" },

  // Insurance
  { pattern: /geico/i, name: "GEICO", type: "insurance" },
  { pattern: /state\s*farm/i, name: "State Farm", type: "insurance" },
  { pattern: /allstate/i, name: "Allstate", type: "insurance" },
  { pattern: /progressive/i, name: "Progressive", type: "insurance" },
  { pattern: /liberty\s*mutual/i, name: "Liberty Mutual", type: "insurance" },

  // Gym/Fitness
  { pattern: /planet\s*fitness/i, name: "Planet Fitness", type: "fitness" },
  { pattern: /la\s*fitness/i, name: "LA Fitness", type: "fitness" },
  { pattern: /equinox/i, name: "Equinox", type: "fitness" },
  { pattern: /peloton/i, name: "Peloton", type: "subscription" },
];

// Category mapping from Plaid categories to our expense categories
// Maps to actual category names in expense_categories table:
// - Miscellaneous, Software & SaaS, Labor & Contractors, Marketing & Advertising,
// - Travel & Entertainment, Office & Administrative, Data & Lead Sources,
// - Email Infrastructure, Professional Services, Utilities & Communications,
// - Insurance & Benefits, Equipment & Hardware
const CATEGORY_MAPPING: Record<string, string> = {
  // Plaid personal_finance_category format (UPPERCASE)
  "TRAVEL": "Travel & Entertainment",
  "TRANSPORTATION": "Travel & Entertainment",
  "FOOD_AND_DRINK": "Travel & Entertainment",
  "ENTERTAINMENT": "Travel & Entertainment",
  "GENERAL_MERCHANDISE": "Office & Administrative",
  "GENERAL_SERVICES": "Professional Services",
  "GOVERNMENT_AND_NON_PROFIT": "Professional Services",
  "HOME_IMPROVEMENT": "Office & Administrative",
  "MEDICAL": "Insurance & Benefits",
  "PERSONAL_CARE": "Miscellaneous",
  "RENT_AND_UTILITIES": "Utilities & Communications",
  "TRANSFER_OUT": "Miscellaneous",
  "TRANSFER_IN": "Miscellaneous",
  "LOAN_PAYMENTS": "Miscellaneous",
  "BANK_FEES": "Professional Services",
  "INCOME": "Miscellaneous",

  // Legacy format (Title Case)
  "Travel": "Travel & Entertainment",
  "Airlines and Aviation Services": "Travel & Entertainment",
  "Car Service": "Travel & Entertainment",
  "Lodging": "Travel & Entertainment",
  "Food and Drink": "Travel & Entertainment",
  "Restaurants": "Travel & Entertainment",
  "Coffee Shop": "Travel & Entertainment",
  "Fast Food": "Travel & Entertainment",
  "Shops": "Office & Administrative",
  "Supermarkets and Groceries": "Office & Administrative",
  "General Merchandise": "Office & Administrative",
  "Computer and Electronics": "Equipment & Hardware",
  "Digital Purchase": "Software & SaaS",
  "Service": "Professional Services",
  "Business Services": "Professional Services",
  "Financial": "Professional Services",
  "Insurance": "Insurance & Benefits",
  "Transportation": "Travel & Entertainment",
  "Taxi": "Travel & Entertainment",
  "Gas Stations": "Travel & Entertainment",
  "Parking": "Travel & Entertainment",
  "Subscription": "Software & SaaS",
  "Recreation": "Travel & Entertainment",
};

interface Transaction {
  id: string;
  name: string;
  merchant_name?: string;
  amount: number;
  plaid_category?: string[];
  personal_finance_category?: string;
}

interface CategorizationResult {
  transaction_id: string;
  suggested_category: string | null;
  suggested_category_id: string | null;
  is_recurring: boolean;
  recurring_type?: string;
  recurring_name?: string;
  confidence: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { transaction_ids, auto_apply } = await req.json();

    if (!transaction_ids || !Array.isArray(transaction_ids)) {
      throw new Error("transaction_ids array is required");
    }

    // Get transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("bank_transactions")
      .select("*")
      .in("id", transaction_ids);

    if (txError) throw txError;

    // Get our expense categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from("expense_categories")
      .select("id, name")
      .eq("is_active", true);

    if (catError) throw catError;

    const categoryMap = new Map(categories.map((c: any) => [c.name.toLowerCase(), c.id]));

    // Fetch learned vendor rules
    const { data: learnedRules } = await supabaseAdmin
      .from("expense_learning_log")
      .select("vendor_name, learned_mapping, confidence_score")
      .eq("learning_type", "vendor_category")
      .eq("is_active", true)
      .gte("confidence_score", 0.7);

    console.log(`Loaded ${learnedRules?.length || 0} learned vendor rules`);

    const results: CategorizationResult[] = [];

    for (const tx of transactions || []) {
      const merchantName = tx.merchant_name || tx.name || "";
      const normalizedMerchant = normalizeVendorName(merchantName);

      // Check for recurring pattern
      let isRecurring = false;
      let recurringType: string | undefined;
      let recurringName: string | undefined;

      for (const pattern of RECURRING_PATTERNS) {
        if (pattern.pattern.test(merchantName)) {
          isRecurring = true;
          recurringType = pattern.type;
          recurringName = pattern.name;
          break;
        }
      }

      // Determine category
      let suggestedCategory: string | null = null;
      let suggestedCategoryId: string | null = null;
      let confidence: "high" | "medium" | "low" = "low";

      // FIRST: Check learned vendor rules (highest priority)
      if (learnedRules && learnedRules.length > 0 && !suggestedCategoryId) {
        const matchedRule = learnedRules.find((r: LearnedRule) =>
          normalizedMerchant.includes(r.vendor_name) || r.vendor_name.includes(normalizedMerchant)
        );
        if (matchedRule) {
          suggestedCategoryId = matchedRule.learned_mapping.category_id;
          confidence = "high";
          console.log(`Learned rule matched: "${normalizedMerchant}" → category ${suggestedCategoryId}`);
        }
      }

      // SECOND: Try to match from Plaid's category (if no learned rule matched)
      if (!suggestedCategoryId && tx.personal_finance_category) {
        const mapped = CATEGORY_MAPPING[tx.personal_finance_category];
        if (mapped) {
          suggestedCategory = mapped;
          confidence = "high";
        }
      }

      // If no match, try Plaid's category array
      if (!suggestedCategoryId && !suggestedCategory && tx.plaid_category && tx.plaid_category.length > 0) {
        for (const cat of tx.plaid_category) {
          const mapped = CATEGORY_MAPPING[cat];
          if (mapped) {
            suggestedCategory = mapped;
            confidence = "medium";
            break;
          }
        }
      }

      // If still no match, use recurring type to infer
      if (!suggestedCategoryId && !suggestedCategory && isRecurring) {
        switch (recurringType) {
          case "subscription":
            suggestedCategory = "Software & SaaS";
            confidence = "medium";
            break;
          case "utility":
            suggestedCategory = "Utilities & Communications";
            confidence = "high";
            break;
          case "insurance":
            suggestedCategory = "Insurance & Benefits";
            confidence = "high";
            break;
          case "fitness":
            suggestedCategory = "Travel & Entertainment";
            confidence = "medium";
            break;
        }
      }

      // Look up category ID (if not already set by learned rule)
      if (suggestedCategory && !suggestedCategoryId) {
        suggestedCategoryId = categoryMap.get(suggestedCategory.toLowerCase()) || null;

        // If exact match not found, try partial match
        if (!suggestedCategoryId) {
          for (const [name, id] of categoryMap.entries()) {
            if (name.includes(suggestedCategory.toLowerCase()) ||
                suggestedCategory.toLowerCase().includes(name)) {
              suggestedCategoryId = id;
              break;
            }
          }
        }
      }

      results.push({
        transaction_id: tx.id,
        suggested_category: suggestedCategory,
        suggested_category_id: suggestedCategoryId,
        is_recurring: isRecurring,
        recurring_type: recurringType,
        recurring_name: recurringName,
        confidence,
      });

      // Auto-apply if requested and we have high confidence
      if (auto_apply && suggestedCategoryId && confidence !== "low") {
        await supabaseAdmin
          .from("bank_transactions")
          .update({
            category_id: suggestedCategoryId,
            status: "categorized",
          })
          .eq("id", tx.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        categorized: results.filter(r => r.suggested_category_id).length,
        recurring: results.filter(r => r.is_recurring).length,
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
