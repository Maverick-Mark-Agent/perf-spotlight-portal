import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface Attachment {
  file_name: string;
  file_type: string;
  base64_content: string;
}

type AssistantContext = 'expenses' | 'bank_transactions';

interface ContextData {
  pendingCount?: number;
  categorizedCount?: number;
  recurringCount?: number;
  categories?: { id: string; name: string }[];
}

interface ChatRequest {
  session_id?: string;
  message: string;
  attachments?: Attachment[];
  context?: AssistantContext;
  context_data?: ContextData;
}

interface ExpenseData {
  description: string;
  amount: number;
  expense_date: string;
  vendor_name?: string;
  category_suggestion?: string;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

// Intent detection types
type UserIntent =
  | 'create_expense'
  | 'delete_expense'
  | 'edit_expense'
  | 'approve_expense'
  | 'list_expenses'
  | 'upload_file'
  | 'confirm_action'
  | 'general_question';

interface ParsedIntent {
  intent: UserIntent;
  params: {
    expense_ids?: string[];
    filters?: {
      date_range?: { start: string; end: string };
      category?: string;
      vendor?: string;
      status?: 'pending' | 'approved' | 'rejected';
      amount_range?: { min?: number; max?: number };
      description_contains?: string;
    };
    updates?: {
      amount?: number;
      category_id?: string;
      vendor_id?: string;
      description?: string;
      notes?: string;
    };
    confirmation_required?: boolean;
  };
}

interface PendingAction {
  type: 'delete' | 'edit' | 'approve';
  expense_ids: string[];
  expense_details: Array<{ id: string; description: string; amount: number }>;
  awaiting_confirmation: boolean;
}

serve(async (req) => {
  // Handle CORS preflight for all routes
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    // Extract just the last part of the path (handles /functions/v1/ai-expense-assistant/chat)
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    const pathname = lastPart === 'ai-expense-assistant' ? '' : `/${lastPart}`;

    console.log('Request path:', url.pathname, '-> Parsed as:', pathname);

    // Route handling
    if (pathname === '/chat' || pathname === '' || pathname === '/') {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body: ChatRequest = await req.json();
      const result = await handleChat(supabase, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/parse-statement') {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const result = await parseStatement(supabase, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/match-receipts') {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const body = await req.json();
      const result = await matchReceipts(supabase, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-expense-assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleChat(supabase: any, request: ChatRequest) {
  const { session_id, message, attachments, context = 'expenses', context_data } = request;

  // Get or create session
  let sessionId = session_id;
  if (!sessionId) {
    const { data: newSession, error } = await supabase
      .from('expense_assistant_sessions')
      .insert({})
      .select()
      .single();

    if (error) throw error;
    sessionId = newSession.id;
  }

  // Save user message
  await supabase.from('expense_assistant_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
    attachments: attachments ? attachments.map(a => ({
      file_name: a.file_name,
      file_type: a.file_type,
    })) : [],
  });

  // Fetch context: categories, vendors, recent expenses, pending action, AND business profile
  const [categoriesRes, vendorsRes, expensesRes, sessionRes, profileRes, learningsRes, ytdRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, slug, schedule_c_line, deduction_percentage').eq('is_active', true),
    supabase.from('vendors').select('id, name, display_name, category_id').eq('is_active', true),
    supabase.from('expenses').select('id, description, amount, expense_date, vendor_id, category_id, status').order('created_at', { ascending: false }).limit(20),
    sessionId ? supabase.from('expense_assistant_sessions').select('pending_action').eq('id', sessionId).single() : Promise.resolve({ data: null }),
    supabase.from('business_profile').select('*').limit(1).single(),
    supabase.from('expense_learning_log').select('*').eq('is_active', true).limit(50),
    supabase.rpc('get_ytd_tax_summary').single(),
  ]);

  const categories = categoriesRes.data || [];
  const vendors = vendorsRes.data || [];
  const recentExpenses = expensesRes.data || [];
  const businessProfile = profileRes.data || null;
  const learnings = learningsRes.data || [];
  const ytdTaxSummary = ytdRes.data || null;
  const pendingAction: PendingAction | null = sessionRes.data?.pending_action || null;

  // Determine intent and process
  let responseMessage = '';
  let actionsTaken: any = null;

  // Check if attachments include bank statements or receipts
  const hasStatementAttachment = attachments?.some(a =>
    a.file_type === 'text/csv' ||
    (a.file_type === 'application/pdf' && a.file_name.toLowerCase().includes('statement'))
  );

  const hasReceiptAttachment = attachments?.some(a =>
    a.file_type.startsWith('image/') ||
    (a.file_type === 'application/pdf' && !a.file_name.toLowerCase().includes('statement'))
  );

  if (hasStatementAttachment) {
    // Process bank statement
    const statementAttachment = attachments!.find(a =>
      a.file_type === 'text/csv' || a.file_type === 'application/pdf'
    )!;

    const result = await processStatement(supabase, statementAttachment, categories, vendors);
    actionsTaken = result.actions;
    responseMessage = result.message;
  } else if (hasReceiptAttachment) {
    // Process receipts
    const receiptAttachments = attachments!.filter(a =>
      a.file_type.startsWith('image/') || a.file_type === 'application/pdf'
    );

    const result = await processReceipts(supabase, receiptAttachments, categories, vendors);
    actionsTaken = result.actions;
    responseMessage = result.message;
  } else {
    // Detect intent from text message
    const intent = await detectIntent(message, categories, vendors, recentExpenses, pendingAction);
    console.log('Detected intent:', intent.intent, intent.params);

    switch (intent.intent) {
      case 'confirm_action':
        if (pendingAction) {
          const confirmResult = await executeConfirmedAction(supabase, pendingAction, sessionId);
          responseMessage = confirmResult.message;
          actionsTaken = confirmResult.actions;
        } else {
          responseMessage = "There's nothing to confirm. What would you like to do?";
        }
        break;

      case 'delete_expense':
        const deleteResult = await handleDeleteExpenses(supabase, intent, sessionId);
        responseMessage = deleteResult.message;
        actionsTaken = deleteResult.actions;
        break;

      case 'edit_expense':
        const editResult = await handleEditExpenses(supabase, intent, categories);
        responseMessage = editResult.message;
        actionsTaken = editResult.actions;
        break;

      case 'approve_expense':
        const approveResult = await handleApproveExpenses(supabase, intent, sessionId);
        responseMessage = approveResult.message;
        actionsTaken = approveResult.actions;
        break;

      case 'list_expenses':
        const listResult = await handleListExpenses(supabase, intent, categories);
        responseMessage = listResult.message;
        break;

      default:
        // Clear any pending action if user asks something else
        if (pendingAction) {
          await supabase
            .from('expense_assistant_sessions')
            .update({ pending_action: null })
            .eq('id', sessionId);
        }

        // Handle different contexts
        if (context === 'bank_transactions') {
          const result = await handleBankTransactionsChat(supabase, message, categories, context_data);
          responseMessage = result.message;
          actionsTaken = result.actions;
        } else {
          responseMessage = await handleGeneralChat(message, categories, vendors, recentExpenses, businessProfile, learnings, ytdTaxSummary);
        }
    }
  }

  // Save assistant response
  await supabase.from('expense_assistant_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: responseMessage,
    metadata: actionsTaken,
  });

  // Update session stats - fetch current values first then increment
  const { data: currentSession } = await supabase
    .from('expense_assistant_sessions')
    .select('message_count, expenses_created, receipts_matched')
    .eq('id', sessionId)
    .single();

  const updateData: any = {
    last_message_at: new Date().toISOString(),
    message_count: (currentSession?.message_count || 0) + 2,
  };

  if (actionsTaken?.expenses_created?.length) {
    updateData.expenses_created = (currentSession?.expenses_created || 0) + actionsTaken.expenses_created.length;
  }
  if (actionsTaken?.expenses_matched?.length) {
    updateData.receipts_matched = (currentSession?.receipts_matched || 0) + actionsTaken.expenses_matched.length;
  }

  await supabase
    .from('expense_assistant_sessions')
    .update(updateData)
    .eq('id', sessionId);

  return {
    session_id: sessionId,
    message: responseMessage,
    actions_taken: actionsTaken,
  };
}

async function processStatement(
  supabase: any,
  attachment: Attachment,
  categories: any[],
  vendors: any[]
) {
  const actions = {
    expenses_created: [] as any[],
    duplicates_skipped: [] as any[],
    items_needing_review: [] as any[],
  };

  let transactions: ParsedTransaction[] = [];

  if (attachment.file_type === 'text/csv') {
    // Parse CSV directly
    transactions = parseCSV(attachment.base64_content);
  } else if (attachment.file_type === 'application/pdf') {
    // Use Claude Vision to extract transactions from PDF
    transactions = await extractTransactionsFromPDF(attachment.base64_content);
  }

  // Process each transaction
  for (const tx of transactions) {
    // Only process debits (expenses)
    if (tx.type !== 'debit' || tx.amount <= 0) continue;

    // Check for duplicates
    const { data: existingExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount')
      .eq('expense_date', tx.date)
      .gte('amount', tx.amount - 0.01)
      .lte('amount', tx.amount + 0.01);

    if (existingExpenses && existingExpenses.length > 0) {
      actions.duplicates_skipped.push({
        description: tx.description,
        amount: tx.amount,
        reason: `Potential duplicate of existing expense on ${tx.date}`,
      });
      continue;
    }

    // Find or suggest vendor
    const matchedVendor = findVendorMatch(tx.description, vendors);

    // Categorize the expense
    const category = await categorizeExpense(tx.description, matchedVendor, categories);

    // Create the expense
    const { data: newExpense, error } = await supabase
      .from('expenses')
      .insert({
        description: tx.description,
        amount: tx.amount,
        expense_date: tx.date,
        vendor_id: matchedVendor?.id || null,
        category_id: category?.id || categories.find(c => c.slug === 'miscellaneous')?.id,
        status: 'pending',
        has_receipt: false,
      })
      .select()
      .single();

    if (!error && newExpense) {
      // Create default overhead allocation
      await supabase.from('expense_allocations').insert({
        expense_id: newExpense.id,
        is_overhead: true,
        allocation_percentage: 100,
        allocated_amount: tx.amount,
      });

      actions.expenses_created.push({
        id: newExpense.id,
        description: tx.description,
        amount: tx.amount,
        vendor: matchedVendor?.name || 'Unknown',
        category: category?.name || 'Miscellaneous',
      });
    }
  }

  const message = buildStatementSummary(actions);
  return { message, actions };
}

async function processReceipts(
  supabase: any,
  attachments: Attachment[],
  categories: any[],
  vendors: any[]
) {
  const actions = {
    expenses_created: [] as any[],
    expenses_matched: [] as any[],
    items_needing_review: [] as any[],
  };

  for (const attachment of attachments) {
    // Use Claude Vision to extract receipt data
    const receiptData = await extractReceiptData(attachment);

    if (!receiptData) {
      actions.items_needing_review.push({
        description: attachment.file_name,
        amount: 0,
        issue: 'Could not extract data from receipt',
      });
      continue;
    }

    // Try to match to pending expense
    const { data: pendingExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, vendor_id')
      .eq('status', 'pending')
      .eq('has_receipt', false)
      .gte('amount', receiptData.amount - 0.50)
      .lte('amount', receiptData.amount + 0.50);

    let matchedExpense = null;
    if (pendingExpenses && pendingExpenses.length > 0) {
      // Find best match by date proximity
      matchedExpense = pendingExpenses.find(e => {
        const expenseDate = new Date(e.expense_date);
        const receiptDate = new Date(receiptData.date);
        const daysDiff = Math.abs((expenseDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 3;
      }) || pendingExpenses[0];
    }

    // Upload receipt to storage
    const storagePath = `receipts/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${matchedExpense?.id || 'new'}/${attachment.file_name}`;

    const fileBuffer = Uint8Array.from(atob(attachment.base64_content), c => c.charCodeAt(0));
    const { error: uploadError } = await supabase.storage
      .from('expense-receipts')
      .upload(storagePath, fileBuffer, {
        contentType: attachment.file_type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload receipt:', uploadError);
      actions.items_needing_review.push({
        description: attachment.file_name,
        amount: receiptData.amount,
        issue: 'Failed to upload receipt file',
      });
      continue;
    }

    if (matchedExpense) {
      // Link receipt to existing expense and approve
      await supabase.from('expense_receipts').insert({
        expense_id: matchedExpense.id,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        storage_path: storagePath,
        storage_bucket: 'expense-receipts',
      });

      await supabase
        .from('expenses')
        .update({ status: 'approved', has_receipt: true })
        .eq('id', matchedExpense.id);

      actions.expenses_matched.push({
        id: matchedExpense.id,
        description: matchedExpense.description,
        amount: matchedExpense.amount,
        receipt_attached: true,
      });
    } else {
      // Create new expense from receipt
      const matchedVendor = findVendorMatch(receiptData.vendor_name || '', vendors);
      const category = await categorizeExpense(receiptData.vendor_name || '', matchedVendor, categories);

      const { data: newExpense, error } = await supabase
        .from('expenses')
        .insert({
          description: receiptData.vendor_name || attachment.file_name,
          amount: receiptData.amount,
          expense_date: receiptData.date,
          vendor_id: matchedVendor?.id || null,
          category_id: category?.id || categories.find(c => c.slug === 'miscellaneous')?.id,
          status: 'approved',
          has_receipt: true,
        })
        .select()
        .single();

      if (!error && newExpense) {
        // Create default overhead allocation
        await supabase.from('expense_allocations').insert({
          expense_id: newExpense.id,
          is_overhead: true,
          allocation_percentage: 100,
          allocated_amount: receiptData.amount,
        });

        // Link receipt
        await supabase.from('expense_receipts').insert({
          expense_id: newExpense.id,
          file_name: attachment.file_name,
          file_type: attachment.file_type,
          storage_path: storagePath,
          storage_bucket: 'expense-receipts',
        });

        actions.expenses_created.push({
          id: newExpense.id,
          description: receiptData.vendor_name || attachment.file_name,
          amount: receiptData.amount,
        });
      }
    }
  }

  const message = buildReceiptSummary(actions);
  return { message, actions };
}

function parseCSV(base64Content: string): ParsedTransaction[] {
  const content = atob(base64Content);
  const lines = content.split('\n').filter(line => line.trim());
  const transactions: ParsedTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Try common CSV formats
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));

    if (parts.length >= 3) {
      // Try to detect date, description, amount columns
      const datePatterns = [/^\d{1,2}\/\d{1,2}\/\d{2,4}$/, /^\d{4}-\d{2}-\d{2}$/];
      let dateIndex = parts.findIndex(p => datePatterns.some(pattern => pattern.test(p)));

      if (dateIndex === -1) dateIndex = 0;

      const amountParts = parts.filter(p => /^-?\$?[\d,]+\.?\d*$/.test(p.replace(/[()]/g, '')));
      const amount = amountParts.length > 0
        ? parseFloat(amountParts[0].replace(/[$,()]/g, '').replace(/^\((.+)\)$/, '-$1'))
        : 0;

      const descriptionIndex = parts.findIndex((_, idx) =>
        idx !== dateIndex && !amountParts.includes(parts[idx])
      );

      if (amount !== 0) {
        transactions.push({
          date: normalizeDate(parts[dateIndex]),
          description: parts[descriptionIndex] || parts[1] || 'Unknown',
          amount: Math.abs(amount),
          type: amount < 0 ? 'debit' : 'credit',
        });
      }
    }
  }

  return transactions;
}

function normalizeDate(dateStr: string): string {
  // Convert various date formats to YYYY-MM-DD
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // Already YYYY-MM-DD
      return dateStr;
    } else {
      // MM/DD/YY or MM/DD/YYYY
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

async function extractTransactionsFromPDF(base64Content: string): Promise<ParsedTransaction[]> {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return [];
  }

  // Use the document type for PDFs (requires newer API version)
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Content,
            },
          },
          {
            type: 'text',
            text: `You are a financial data extraction expert. Analyze this bank statement PDF and extract ALL transactions.

For each transaction, provide:
- date: The transaction date in YYYY-MM-DD format
- description: The merchant/payee name (cleaned up, remove extra numbers/codes)
- amount: The transaction amount as a positive number
- type: "debit" for money going out (purchases, withdrawals, payments), "credit" for money coming in (deposits, refunds)

Important:
- Include ALL transactions from the statement
- Use the actual transaction dates from the statement, not the statement date
- For amounts, use the absolute value (positive number)
- Identify debits vs credits based on the +/- sign or column they appear in

Return ONLY a valid JSON array, no other text. Example format:
[{"date": "2024-10-05", "description": "AMAZON PURCHASE", "amount": 45.99, "type": "debit"}]`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', errorText);

    // If PDF processing fails, return empty with helpful log
    if (errorText.includes('document') || errorText.includes('pdf')) {
      console.error('PDF processing not supported or failed. Consider exporting as CSV.');
    }
    return [];
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || '';

  console.log('Claude response for PDF:', content.substring(0, 500));

  try {
    // Try to parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const transactions = JSON.parse(jsonMatch[0]);
      console.log(`Successfully extracted ${transactions.length} transactions from PDF`);
      return transactions;
    }
  } catch (e) {
    console.error('Failed to parse transactions:', e);
  }

  return [];
}

async function extractReceiptData(attachment: Attachment): Promise<ExpenseData | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return null;
  }

  const mediaType = attachment.file_type.startsWith('image/')
    ? attachment.file_type
    : 'application/pdf';

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: attachment.base64_content,
            },
          },
          {
            type: 'text',
            text: `Extract the following from this receipt:
1. vendor_name - The business/merchant name
2. amount - The total amount (number only)
3. expense_date - The date (YYYY-MM-DD format)

Return ONLY a JSON object with these fields. If you can't read something, use null.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    console.error('Claude API error:', await response.text());
    return null;
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        description: data.vendor_name || 'Unknown',
        amount: parseFloat(data.amount) || 0,
        expense_date: data.expense_date || new Date().toISOString().split('T')[0],
        vendor_name: data.vendor_name,
      };
    }
  } catch (e) {
    console.error('Failed to parse receipt data:', e);
  }

  return null;
}

function findVendorMatch(description: string, vendors: any[]): any | null {
  const descLower = description.toLowerCase();

  // Exact match
  let match = vendors.find(v =>
    v.name.toLowerCase() === descLower ||
    v.display_name?.toLowerCase() === descLower
  );

  if (match) return match;

  // Partial match
  match = vendors.find(v =>
    descLower.includes(v.name.toLowerCase()) ||
    v.name.toLowerCase().includes(descLower) ||
    (v.display_name && descLower.includes(v.display_name.toLowerCase()))
  );

  return match || null;
}

async function categorizeExpense(
  description: string,
  vendor: any | null,
  categories: any[]
): Promise<any | null> {
  // If vendor has a default category, use it
  if (vendor?.category_id) {
    return categories.find(c => c.id === vendor.category_id) || null;
  }

  // Use keyword matching for common categories
  const descLower = description.toLowerCase();

  const categoryKeywords: { [key: string]: string[] } = {
    'software-saas': ['software', 'saas', 'subscription', 'app', 'cloud', 'hosting'],
    'data-sources': ['data', 'leads', 'api', 'database'],
    'email-infrastructure': ['email', 'smtp', 'mailgun', 'sendgrid'],
    'labor-contractors': ['contractor', 'freelance', 'payroll', 'salary'],
    'marketing': ['marketing', 'ads', 'advertising', 'facebook', 'google ads'],
    'office-admin': ['office', 'supplies', 'equipment', 'furniture'],
    'professional-services': ['legal', 'accounting', 'consulting'],
    'travel-entertainment': ['travel', 'hotel', 'flight', 'meal', 'restaurant'],
    'utilities-comms': ['phone', 'internet', 'utility', 'electric'],
  };

  for (const [slug, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => descLower.includes(kw))) {
      return categories.find(c => c.slug === slug) || null;
    }
  }

  return categories.find(c => c.slug === 'miscellaneous') || null;
}

async function handleGeneralChat(
  message: string,
  categories: any[],
  vendors: any[],
  recentExpenses: any[],
  businessProfile: any,
  learnings: any[],
  ytdTaxSummary: any
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "I'm sorry, but the AI service is not configured. Please contact your administrator.";
  }

  // Build business context section
  const businessContext = businessProfile ? `
## YOUR CLIENT'S BUSINESS
- Business Name: ${businessProfile.business_name || 'Not set'}
- Business Type: ${businessProfile.business_type || 'Not set'}
- Entity Type: ${businessProfile.entity_type || 'LLC'} (affects tax treatment)
- Industry: ${businessProfile.industry || 'Not set'}
- State: ${businessProfile.state || 'Not set'}
- Description: ${businessProfile.business_description || 'No description provided'}
- Estimated Annual Revenue: $${businessProfile.estimated_annual_revenue?.toLocaleString() || 'Not set'}
- Tax Bracket: ${businessProfile.estimated_tax_bracket || 22}%
${businessProfile.ai_bookkeeping_notes ? `- Notes from past conversations: ${businessProfile.ai_bookkeeping_notes}` : ''}
` : '';

  // Build YTD tax summary
  const taxContext = ytdTaxSummary ? `
## YTD TAX SUMMARY (${new Date().getFullYear()})
- YTD Revenue: $${Number(ytdTaxSummary.total_revenue || 0).toLocaleString()}
- YTD Expenses: $${Number(ytdTaxSummary.total_expenses || 0).toLocaleString()}
- Deductible Expenses: $${Number(ytdTaxSummary.deductible_expenses || 0).toLocaleString()}
- Estimated Taxable Income: $${Number(ytdTaxSummary.taxable_income || 0).toLocaleString()}
- Estimated Federal Tax: $${Number(ytdTaxSummary.estimated_federal_tax || 0).toLocaleString()}
- Estimated Self-Employment Tax: $${Number(ytdTaxSummary.estimated_se_tax || 0).toLocaleString()}
- Total Estimated Tax: $${Number(ytdTaxSummary.total_tax_liability || 0).toLocaleString()}
- Effective Tax Rate: ${Number(ytdTaxSummary.effective_tax_rate || 0).toFixed(1)}%
` : '';

  // Build category tax info
  const categoryTaxInfo = categories.map(c =>
    `- ${c.name}: Schedule C Line ${c.schedule_c_line || 'N/A'}, ${c.deduction_percentage || 100}% deductible`
  ).join('\n');

  // Build learned patterns
  const learnedPatterns = learnings.filter(l => l.learning_type === 'vendor_category').slice(0, 10).map(l =>
    `- ${l.vendor_name}: typically ${l.pattern_description || JSON.stringify(l.learned_mapping)}`
  ).join('\n');

  const taxTips = learnings.filter(l => l.learning_type === 'tax_tip').map(l =>
    `- ${l.pattern_description}`
  ).join('\n');

  const systemPrompt = `You are an expert bookkeeper and tax advisor AI assistant for a small business. You combine the knowledge of a CPA with the helpfulness of a personal financial assistant. You've been working with this client for years and understand their business deeply.

## YOUR ROLE
1. **Bookkeeping Expert**: Help track, categorize, and manage expenses. Ensure proper documentation for tax purposes.
2. **Tax Advisor**: Provide tax planning advice, estimate quarterly taxes, identify deductions, and ensure compliance.
3. **Business Analyst**: Spot spending patterns, suggest cost savings, and provide financial insights.
4. **Proactive Assistant**: Don't just answer questions - offer relevant tips and warnings when appropriate.

${businessContext}
${taxContext}
## EXPENSE CATEGORIES & TAX TREATMENT
${categoryTaxInfo}

## WHAT I'VE LEARNED ABOUT THIS BUSINESS
${learnedPatterns || 'No patterns learned yet.'}

## TAX TIPS I KNOW
${taxTips || 'Standard tax knowledge applies.'}

## CAPABILITIES
You can help users:
- **Manage expenses**: "delete expense...", "edit expense...", "approve expenses", "show expenses"
- **Upload documents**: Upload bank statements (CSV/PDF) or receipts
- **Get tax advice**: Ask about deductions, quarterly estimates, tax optimization
- **Understand spending**: "What did I spend on...?", "Show my YTD summary"
- **Plan ahead**: "How much should I set aside for taxes?", "What deductions am I missing?"

## RECENT EXPENSES FOR CONTEXT
${recentExpenses.slice(0, 5).map(e => `- ${e.description}: $${e.amount} on ${e.expense_date} (${e.status})`).join('\n')}

## COMMUNICATION STYLE
- Be conversational but professional, like a trusted financial advisor
- Give specific, actionable advice when possible
- Reference their actual numbers and business context
- Proactively warn about tax deadlines, missing receipts, or potential audit flags
- Keep responses concise but complete
- If you don't know something specific to their situation, say so and suggest they consult their CPA

## IMPORTANT TAX KNOWLEDGE
- Self-employment tax is 15.3% (12.4% Social Security + 2.9% Medicare) on net self-employment income
- Quarterly estimated taxes are due: April 15, June 15, September 15, January 15
- Keep receipts for all expenses over $75 (IRS requirement)
- Business meals are 50% deductible (unless for clients/employees)
- Home office deduction: Can use simplified method ($5/sq ft, max 300 sq ft = $1,500)
- Vehicle: Can deduct actual expenses OR standard mileage rate (67¢/mile for 2024)
- Section 179 allows immediate deduction of equipment/software purchases

Available vendors: ${vendors.map(v => v.name).join(', ')}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024, // Increased for more detailed tax/bookkeeping advice
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: message,
      }],
    }),
  });

  if (!response.ok) {
    console.error('Claude API error:', await response.text());
    return "I'm having trouble processing your request. Please try again.";
  }

  const result = await response.json();
  return result.content?.[0]?.text || "I can help you with expense tracking, tax planning, and bookkeeping. Try asking about your YTD tax summary, or upload a bank statement to get started!";
}

function buildStatementSummary(actions: any): string {
  const parts: string[] = [];

  if (actions.expenses_created.length > 0) {
    const total = actions.expenses_created.reduce((sum: number, e: any) => sum + e.amount, 0);
    parts.push(`Created ${actions.expenses_created.length} expense${actions.expenses_created.length > 1 ? 's' : ''} totaling $${total.toFixed(2)}:`);
    actions.expenses_created.slice(0, 5).forEach((e: any) => {
      parts.push(`  - ${e.description}: $${e.amount.toFixed(2)} (${e.category})`);
    });
    if (actions.expenses_created.length > 5) {
      parts.push(`  ... and ${actions.expenses_created.length - 5} more`);
    }
  }

  if (actions.duplicates_skipped.length > 0) {
    parts.push(`\nSkipped ${actions.duplicates_skipped.length} potential duplicate${actions.duplicates_skipped.length > 1 ? 's' : ''}.`);
  }

  if (actions.items_needing_review.length > 0) {
    parts.push(`\n${actions.items_needing_review.length} item${actions.items_needing_review.length > 1 ? 's' : ''} need${actions.items_needing_review.length === 1 ? 's' : ''} review.`);
  }

  if (parts.length === 0) {
    parts.push("No transactions found to import.\n\n**Tip:** For best results, export your bank statement as a CSV file. Most banks offer this option in their online banking portal under 'Download' or 'Export'.\n\nCSV files are more reliable than PDFs for automatic processing.");
  } else {
    parts.push("\nAll new expenses are pending - upload receipts to approve them!");
  }

  return parts.join('\n');
}

function buildReceiptSummary(actions: any): string {
  const parts: string[] = [];

  if (actions.expenses_matched.length > 0) {
    parts.push(`Matched ${actions.expenses_matched.length} receipt${actions.expenses_matched.length > 1 ? 's' : ''} to existing expenses (auto-approved):`);
    actions.expenses_matched.forEach((e: any) => {
      parts.push(`  - ${e.description}: $${e.amount.toFixed(2)}`);
    });
  }

  if (actions.expenses_created.length > 0) {
    parts.push(`\nCreated ${actions.expenses_created.length} new expense${actions.expenses_created.length > 1 ? 's' : ''} from receipts:`);
    actions.expenses_created.forEach((e: any) => {
      parts.push(`  - ${e.description}: $${e.amount.toFixed(2)}`);
    });
  }

  if (actions.items_needing_review.length > 0) {
    parts.push(`\n${actions.items_needing_review.length} receipt${actions.items_needing_review.length > 1 ? 's' : ''} could not be processed:`);
    actions.items_needing_review.forEach((e: any) => {
      parts.push(`  - ${e.description}: ${e.issue}`);
    });
  }

  if (parts.length === 0) {
    parts.push("No receipts were processed. Please try again with valid receipt images.");
  }

  return parts.join('\n');
}

async function parseStatement(supabase: any, body: any) {
  const { attachment } = body;

  const [categoriesRes, vendorsRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, slug').eq('is_active', true),
    supabase.from('vendors').select('id, name, display_name, category_id').eq('is_active', true),
  ]);

  return processStatement(supabase, attachment, categoriesRes.data || [], vendorsRes.data || []);
}

async function matchReceipts(supabase: any, body: any) {
  const { attachments } = body;

  const [categoriesRes, vendorsRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, slug').eq('is_active', true),
    supabase.from('vendors').select('id, name, display_name, category_id').eq('is_active', true),
  ]);

  return processReceipts(supabase, attachments, categoriesRes.data || [], vendorsRes.data || []);
}

// ============ INTENT DETECTION & CRUD HANDLERS ============

async function detectIntent(
  message: string,
  categories: any[],
  vendors: any[],
  recentExpenses: any[],
  pendingAction?: PendingAction | null
): Promise<ParsedIntent> {
  // Check for simple confirmation responses first
  const lowerMessage = message.toLowerCase().trim();
  if (pendingAction?.awaiting_confirmation) {
    if (['yes', 'y', 'confirm', 'do it', 'proceed', 'ok', 'sure'].includes(lowerMessage)) {
      return { intent: 'confirm_action', params: {} };
    }
    if (['no', 'n', 'cancel', 'nevermind', 'stop'].includes(lowerMessage)) {
      return { intent: 'general_question', params: {} };
    }
  }

  if (!ANTHROPIC_API_KEY) {
    return { intent: 'general_question', params: {} };
  }

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const currentYear = today.getFullYear();

  const systemPrompt = `You are an expense management assistant that analyzes user messages to determine their intent.

Available categories: ${categories.map(c => `${c.name} (id: ${c.id})`).join(', ')}
Known vendors: ${vendors.map(v => `${v.name} (id: ${v.id})`).join(', ')}

Recent expenses for reference:
${recentExpenses.slice(0, 10).map(e => `- ID: ${e.id.slice(0, 8)}, Description: "${e.description}", Amount: $${e.amount}, Date: ${e.expense_date}, Status: ${e.status || 'pending'}`).join('\n')}

Today's date is: ${today.toISOString().split('T')[0]}
Current month: ${currentMonth}

Analyze the user's message and determine their intent. Be precise with dates:
- "October" means ${currentYear}-10-01 to ${currentYear}-10-31
- "November" means ${currentYear}-11-01 to ${currentYear}-11-30
- "this month" means the current month
- "last month" means the previous month

Return ONLY valid JSON (no markdown, no explanation):
{
  "intent": "delete_expense" | "edit_expense" | "approve_expense" | "list_expenses" | "create_expense" | "general_question",
  "params": {
    "expense_ids": ["full-uuid-if-mentioned"],
    "filters": {
      "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
      "category": "category name if mentioned",
      "vendor": "vendor name if mentioned",
      "status": "pending" | "approved" | "rejected",
      "amount_range": { "min": number, "max": number },
      "description_contains": "text to search"
    },
    "updates": {
      "category_id": "uuid if changing category",
      "amount": number,
      "description": "new description"
    }
  }
}

Only include fields that are relevant to the user's request.`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      console.error('Intent detection error:', await response.text());
      return { intent: 'general_question', params: {} };
    }

    const result = await response.json();
    const content = result.content?.[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || 'general_question',
        params: parsed.params || {},
      };
    }
  } catch (e) {
    console.error('Failed to parse intent:', e);
  }

  return { intent: 'general_question', params: {} };
}

async function handleDeleteExpenses(
  supabase: any,
  intent: ParsedIntent,
  sessionId: string
): Promise<{ message: string; actions: any; pendingAction?: PendingAction }> {
  const actions = {
    expenses_deleted: [] as any[],
  };

  // Build query based on filters
  let query = supabase.from('expenses').select('id, description, amount, expense_date, status');

  if (intent.params.expense_ids && intent.params.expense_ids.length > 0) {
    // Find expenses by partial ID match
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, status');

    const matchedExpenses = allExpenses?.filter((e: any) =>
      intent.params.expense_ids?.some(partialId => e.id.startsWith(partialId))
    ) || [];

    if (matchedExpenses.length === 0) {
      return {
        message: "I couldn't find any expenses matching those IDs. Try saying 'show my expenses' to see the list.",
        actions,
      };
    }

    // Single expense - delete immediately
    if (matchedExpenses.length === 1) {
      const expense = matchedExpenses[0];
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);

      if (error) {
        return { message: `Failed to delete expense: ${error.message}`, actions };
      }

      actions.expenses_deleted.push(expense);
      return {
        message: `Deleted expense: "${expense.description}" - $${Number(expense.amount).toFixed(2)}`,
        actions,
      };
    }
  }

  // Apply filters for bulk operations
  if (intent.params.filters?.date_range) {
    query = query
      .gte('expense_date', intent.params.filters.date_range.start)
      .lte('expense_date', intent.params.filters.date_range.end);
  }

  if (intent.params.filters?.category) {
    const { data: cat } = await supabase
      .from('expense_categories')
      .select('id')
      .ilike('name', `%${intent.params.filters.category}%`)
      .single();
    if (cat) query = query.eq('category_id', cat.id);
  }

  if (intent.params.filters?.vendor) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .ilike('name', `%${intent.params.filters.vendor}%`)
      .single();
    if (vendor) query = query.eq('vendor_id', vendor.id);
  }

  if (intent.params.filters?.status) {
    query = query.eq('status', intent.params.filters.status);
  }

  if (intent.params.filters?.description_contains) {
    query = query.ilike('description', `%${intent.params.filters.description_contains}%`);
  }

  const { data: expenses, error } = await query;

  if (error || !expenses || expenses.length === 0) {
    return {
      message: "I couldn't find any expenses matching your criteria.",
      actions,
    };
  }

  const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

  // Require confirmation for bulk delete
  if (expenses.length > 1) {
    const pendingAction: PendingAction = {
      type: 'delete',
      expense_ids: expenses.map((e: any) => e.id),
      expense_details: expenses.map((e: any) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
      })),
      awaiting_confirmation: true,
    };

    // Store pending action in session
    await supabase
      .from('expense_assistant_sessions')
      .update({ pending_action: pendingAction })
      .eq('id', sessionId);

    const previewList = expenses.slice(0, 5).map((e: any) =>
      `  - ${e.description}: $${Number(e.amount).toFixed(2)} (${e.expense_date})`
    ).join('\n');
    const moreText = expenses.length > 5 ? `\n  ... and ${expenses.length - 5} more` : '';

    return {
      message: `Found ${expenses.length} expenses totaling $${total.toFixed(2)}:\n${previewList}${moreText}\n\n**Are you sure you want to delete all of them?** Reply "yes" to confirm or "no" to cancel.`,
      actions,
      pendingAction,
    };
  }

  // Single expense from filter - delete immediately
  const expense = expenses[0];
  const { error: deleteError } = await supabase.from('expenses').delete().eq('id', expense.id);

  if (deleteError) {
    return { message: `Failed to delete expense: ${deleteError.message}`, actions };
  }

  actions.expenses_deleted.push(expense);
  return {
    message: `Deleted expense: "${expense.description}" - $${Number(expense.amount).toFixed(2)}`,
    actions,
  };
}

async function executeConfirmedAction(
  supabase: any,
  pendingAction: PendingAction,
  sessionId: string
): Promise<{ message: string; actions: any }> {
  const actions: any = {};

  // Clear pending action
  await supabase
    .from('expense_assistant_sessions')
    .update({ pending_action: null })
    .eq('id', sessionId);

  if (pendingAction.type === 'delete') {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .in('id', pendingAction.expense_ids);

    if (error) {
      return { message: `Failed to delete expenses: ${error.message}`, actions };
    }

    const total = pendingAction.expense_details.reduce((sum, e) => sum + e.amount, 0);
    actions.expenses_deleted = pendingAction.expense_details;

    return {
      message: `Deleted ${pendingAction.expense_ids.length} expenses totaling $${total.toFixed(2)}.`,
      actions,
    };
  }

  if (pendingAction.type === 'approve') {
    const { error } = await supabase
      .from('expenses')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', pendingAction.expense_ids);

    if (error) {
      return { message: `Failed to approve expenses: ${error.message}`, actions };
    }

    const total = pendingAction.expense_details.reduce((sum, e) => sum + e.amount, 0);
    actions.expenses_approved = pendingAction.expense_details;

    return {
      message: `Approved ${pendingAction.expense_ids.length} expenses totaling $${total.toFixed(2)}.`,
      actions,
    };
  }

  return { message: "Action cancelled.", actions };
}

async function handleEditExpenses(
  supabase: any,
  intent: ParsedIntent,
  categories: any[]
): Promise<{ message: string; actions: any }> {
  const actions = {
    expenses_updated: [] as any[],
  };

  if (!intent.params.updates || Object.keys(intent.params.updates).length === 0) {
    return {
      message: "What would you like to change? You can update the amount, category, description, or notes.",
      actions,
    };
  }

  // Find expense(s) to edit
  let expenses: any[] = [];

  if (intent.params.expense_ids && intent.params.expense_ids.length > 0) {
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date, category_id');

    expenses = allExpenses?.filter((e: any) =>
      intent.params.expense_ids?.some(partialId => e.id.startsWith(partialId))
    ) || [];
  } else if (intent.params.filters) {
    let query = supabase.from('expenses').select('id, description, amount, expense_date, category_id');

    if (intent.params.filters.description_contains) {
      query = query.ilike('description', `%${intent.params.filters.description_contains}%`);
    }
    if (intent.params.filters.date_range) {
      query = query
        .gte('expense_date', intent.params.filters.date_range.start)
        .lte('expense_date', intent.params.filters.date_range.end);
    }

    const { data } = await query.limit(1);
    expenses = data || [];
  }

  if (expenses.length === 0) {
    return {
      message: "I couldn't find the expense you want to edit. Try saying 'show my expenses' to see the list.",
      actions,
    };
  }

  // Build update object
  const updates: any = {};

  if (intent.params.updates.amount !== undefined) {
    updates.amount = intent.params.updates.amount;
  }

  if (intent.params.updates.category_id) {
    updates.category_id = intent.params.updates.category_id;
  } else if (intent.params.filters?.category) {
    // Find category by name
    const cat = categories.find(c =>
      c.name.toLowerCase().includes(intent.params.filters!.category!.toLowerCase())
    );
    if (cat) updates.category_id = cat.id;
  }

  if (intent.params.updates.description) {
    updates.description = intent.params.updates.description;
  }

  if (intent.params.updates.notes) {
    updates.notes = intent.params.updates.notes;
  }

  if (Object.keys(updates).length === 0) {
    return {
      message: "I'm not sure what to update. Please specify what you'd like to change.",
      actions,
    };
  }

  // Update each expense
  for (const expense of expenses) {
    const { error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expense.id);

    if (!error) {
      actions.expenses_updated.push({
        id: expense.id,
        description: expense.description,
        changes: updates,
      });
    }
  }

  if (actions.expenses_updated.length === 0) {
    return { message: "Failed to update expenses.", actions };
  }

  const changesList = Object.entries(updates)
    .map(([key, val]) => `${key}: ${val}`)
    .join(', ');

  return {
    message: `Updated ${actions.expenses_updated.length} expense(s). Changes: ${changesList}`,
    actions,
  };
}

async function handleApproveExpenses(
  supabase: any,
  intent: ParsedIntent,
  sessionId: string
): Promise<{ message: string; actions: any; pendingAction?: PendingAction }> {
  const actions = {
    expenses_approved: [] as any[],
  };

  // Build query for pending expenses
  let query = supabase
    .from('expenses')
    .select('id, description, amount, expense_date')
    .eq('status', 'pending');

  if (intent.params.expense_ids && intent.params.expense_ids.length > 0) {
    const { data: allExpenses } = await supabase
      .from('expenses')
      .select('id, description, amount, expense_date')
      .eq('status', 'pending');

    const matchedExpenses = allExpenses?.filter((e: any) =>
      intent.params.expense_ids?.some(partialId => e.id.startsWith(partialId))
    ) || [];

    if (matchedExpenses.length === 1) {
      const expense = matchedExpenses[0];
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', expense.id);

      if (error) {
        return { message: `Failed to approve expense: ${error.message}`, actions };
      }

      actions.expenses_approved.push(expense);
      return {
        message: `Approved expense: "${expense.description}" - $${Number(expense.amount).toFixed(2)}`,
        actions,
      };
    }
  }

  // Apply filters
  if (intent.params.filters?.date_range) {
    query = query
      .gte('expense_date', intent.params.filters.date_range.start)
      .lte('expense_date', intent.params.filters.date_range.end);
  }

  if (intent.params.filters?.description_contains) {
    query = query.ilike('description', `%${intent.params.filters.description_contains}%`);
  }

  const { data: expenses, error } = await query;

  if (error || !expenses || expenses.length === 0) {
    return {
      message: "No pending expenses found matching your criteria.",
      actions,
    };
  }

  const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

  // Require confirmation for bulk approve
  if (expenses.length > 1) {
    const pendingAction: PendingAction = {
      type: 'approve',
      expense_ids: expenses.map((e: any) => e.id),
      expense_details: expenses.map((e: any) => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
      })),
      awaiting_confirmation: true,
    };

    await supabase
      .from('expense_assistant_sessions')
      .update({ pending_action: pendingAction })
      .eq('id', sessionId);

    const previewList = expenses.slice(0, 5).map((e: any) =>
      `  - ${e.description}: $${Number(e.amount).toFixed(2)}`
    ).join('\n');
    const moreText = expenses.length > 5 ? `\n  ... and ${expenses.length - 5} more` : '';

    return {
      message: `Found ${expenses.length} pending expenses totaling $${total.toFixed(2)}:\n${previewList}${moreText}\n\n**Approve all of them?** Reply "yes" to confirm or "no" to cancel.`,
      actions,
      pendingAction,
    };
  }

  // Single expense - approve immediately
  const expense = expenses[0];
  const { error: approveError } = await supabase
    .from('expenses')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', expense.id);

  if (approveError) {
    return { message: `Failed to approve expense: ${approveError.message}`, actions };
  }

  actions.expenses_approved.push(expense);
  return {
    message: `Approved expense: "${expense.description}" - $${Number(expense.amount).toFixed(2)}`,
    actions,
  };
}

async function handleListExpenses(
  supabase: any,
  intent: ParsedIntent,
  categories: any[]
): Promise<{ message: string; actions: any }> {
  let query = supabase
    .from('expenses')
    .select(`
      id, description, amount, expense_date, status,
      expense_categories(name),
      vendors(name)
    `)
    .order('expense_date', { ascending: false });

  // Apply filters
  if (intent.params.filters?.date_range) {
    query = query
      .gte('expense_date', intent.params.filters.date_range.start)
      .lte('expense_date', intent.params.filters.date_range.end);
  }

  if (intent.params.filters?.status) {
    query = query.eq('status', intent.params.filters.status);
  }

  if (intent.params.filters?.category) {
    const cat = categories.find(c =>
      c.name.toLowerCase().includes(intent.params.filters!.category!.toLowerCase())
    );
    if (cat) query = query.eq('category_id', cat.id);
  }

  if (intent.params.filters?.description_contains) {
    query = query.ilike('description', `%${intent.params.filters.description_contains}%`);
  }

  if (intent.params.filters?.amount_range) {
    if (intent.params.filters.amount_range.min !== undefined) {
      query = query.gte('amount', intent.params.filters.amount_range.min);
    }
    if (intent.params.filters.amount_range.max !== undefined) {
      query = query.lte('amount', intent.params.filters.amount_range.max);
    }
  }

  query = query.limit(20);

  const { data: expenses, error } = await query;

  if (error || !expenses || expenses.length === 0) {
    return {
      message: "No expenses found matching your criteria.",
      actions: {},
    };
  }

  const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

  const expenseList = expenses.map((e: any) => {
    const category = e.expense_categories?.name || 'Uncategorized';
    const vendor = e.vendors?.name || '';
    const status = e.status === 'approved' ? '' : ' (pending)';
    const vendorText = vendor ? ` @ ${vendor}` : '';
    return `  - ${e.id.slice(0, 8)}: ${e.description}${vendorText} - $${Number(e.amount).toFixed(2)} [${category}]${status}`;
  }).join('\n');

  const filterDesc = [];
  if (intent.params.filters?.date_range) {
    filterDesc.push(`${intent.params.filters.date_range.start} to ${intent.params.filters.date_range.end}`);
  }
  if (intent.params.filters?.status) {
    filterDesc.push(`status: ${intent.params.filters.status}`);
  }
  if (intent.params.filters?.category) {
    filterDesc.push(`category: ${intent.params.filters.category}`);
  }

  const filterText = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';

  return {
    message: `Found ${expenses.length} expense${expenses.length > 1 ? 's' : ''} totaling $${total.toFixed(2)}${filterText}:\n\n${expenseList}`,
    actions: {},
  };
}

// ============ BANK TRANSACTIONS CHAT WITH TOOL USE ============

const BANK_TRANSACTION_TOOLS = [
  {
    name: 'bulk_categorize_transactions',
    description: 'Categorize multiple pending bank transactions at once. Use when user asks to categorize transactions by merchant name, description pattern, or amount range.',
    input_schema: {
      type: 'object',
      properties: {
        category_id: {
          type: 'string',
          description: 'The UUID of the category to assign',
        },
        filter: {
          type: 'object',
          properties: {
            merchant_contains: {
              type: 'string',
              description: 'Filter transactions where merchant name contains this text (case insensitive)',
            },
            description_contains: {
              type: 'string',
              description: 'Filter transactions where description contains this text (case insensitive)',
            },
            amount_min: {
              type: 'number',
              description: 'Minimum transaction amount',
            },
            amount_max: {
              type: 'number',
              description: 'Maximum transaction amount',
            },
          },
        },
      },
      required: ['category_id'],
    },
  },
  {
    name: 'auto_categorize_all',
    description: 'Automatically categorize all pending transactions using AI pattern matching. Use when user asks to auto-categorize, smart categorize, or categorize everything automatically.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'convert_categorized_to_expenses',
    description: 'Convert all categorized bank transactions to expenses. Use when user asks to add transactions as expenses, convert to expenses, or move categorized items to expenses.',
    input_schema: {
      type: 'object',
      properties: {
        all: {
          type: 'boolean',
          description: 'If true, convert all categorized transactions',
        },
      },
    },
  },
  {
    name: 'create_category',
    description: 'Create a new expense category. Use when user asks to add a new category or create a category that does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the new category',
        },
        color: {
          type: 'string',
          description: 'Hex color code for the category (e.g., #3b82f6)',
        },
        description: {
          type: 'string',
          description: 'Optional description of what expenses belong in this category',
        },
        is_tax_deductible: {
          type: 'boolean',
          description: 'Whether expenses in this category are tax deductible',
        },
      },
      required: ['name', 'color'],
    },
  },
  {
    name: 'update_category',
    description: 'Update an existing expense category. Use when user asks to rename, change color, or update a category.',
    input_schema: {
      type: 'object',
      properties: {
        category_id: {
          type: 'string',
          description: 'The UUID of the category to update',
        },
        name: {
          type: 'string',
          description: 'New name for the category',
        },
        color: {
          type: 'string',
          description: 'New hex color code',
        },
        description: {
          type: 'string',
          description: 'New description',
        },
        is_tax_deductible: {
          type: 'boolean',
          description: 'Whether expenses are tax deductible',
        },
      },
      required: ['category_id'],
    },
  },
  {
    name: 'get_transaction_summary',
    description: 'Get a summary of pending bank transactions grouped by merchant. Use when user asks for an overview or summary of transactions.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleBankTransactionsChat(
  supabase: any,
  message: string,
  categories: any[],
  contextData?: ContextData
): Promise<{ message: string; actions: any }> {
  if (!ANTHROPIC_API_KEY) {
    return {
      message: "I'm sorry, but the AI service is not configured. Please contact your administrator.",
      actions: null,
    };
  }

  const systemPrompt = `You are an AI assistant helping manage bank transactions imported via Plaid. You can take actions to categorize transactions, create categories, and convert transactions to expenses.

## CURRENT STATE
- Pending transactions: ${contextData?.pendingCount || 0}
- Categorized (ready for conversion): ${contextData?.categorizedCount || 0}
- Recurring payments detected: ${contextData?.recurringCount || 0}

## AVAILABLE CATEGORIES
${categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')}

## YOUR CAPABILITIES
1. **Bulk Categorize**: Categorize multiple transactions by merchant name, description pattern, or amount
2. **Auto-Categorize**: Use AI to automatically categorize all pending transactions
3. **Convert to Expenses**: Move categorized transactions to the expense list
4. **Create Categories**: Add new expense categories when needed
5. **Update Categories**: Modify existing category names, colors, or settings

## GUIDELINES
- Be proactive - if the user asks about categorizing, offer to do it automatically
- Use tool calls to take action, don't just describe what you could do
- After actions, summarize what was done
- If no matching category exists and user wants to categorize something, suggest creating one
- Keep responses concise and action-oriented`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        tools: BANK_TRANSACTION_TOOLS,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return {
        message: "I'm having trouble processing your request. Please try again.",
        actions: null,
      };
    }

    const result = await response.json();
    console.log('Claude response:', JSON.stringify(result, null, 2));

    // Process tool calls if any
    const toolUseBlocks = result.content?.filter((block: any) => block.type === 'tool_use') || [];
    const textBlocks = result.content?.filter((block: any) => block.type === 'text') || [];

    const actions: any = {};
    let toolResults: string[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolResult = await executeToolCall(supabase, toolUse.name, toolUse.input, categories);
      toolResults.push(toolResult.summary);
      Object.assign(actions, toolResult.actions);
    }

    // Combine text response with tool results
    let responseMessage = textBlocks.map((b: any) => b.text).join('\n');

    if (toolResults.length > 0) {
      responseMessage = responseMessage
        ? `${responseMessage}\n\n**Actions taken:**\n${toolResults.join('\n')}`
        : `**Actions taken:**\n${toolResults.join('\n')}`;
    }

    if (!responseMessage) {
      responseMessage = "I can help you categorize bank transactions, create categories, and convert transactions to expenses. What would you like me to do?";
    }

    return {
      message: responseMessage,
      actions: Object.keys(actions).length > 0 ? actions : null,
    };
  } catch (error) {
    console.error('Error in bank transactions chat:', error);
    return {
      message: "I encountered an error processing your request. Please try again.",
      actions: null,
    };
  }
}

async function executeToolCall(
  supabase: any,
  toolName: string,
  input: any,
  categories: any[]
): Promise<{ summary: string; actions: any }> {
  switch (toolName) {
    case 'bulk_categorize_transactions': {
      let query = supabase
        .from('bank_transactions')
        .select('id, merchant_name, name, amount')
        .eq('status', 'pending')
        .gt('amount', 0);

      if (input.filter?.merchant_contains) {
        query = query.ilike('merchant_name', `%${input.filter.merchant_contains}%`);
      }
      if (input.filter?.description_contains) {
        query = query.ilike('name', `%${input.filter.description_contains}%`);
      }
      if (input.filter?.amount_min) {
        query = query.gte('amount', input.filter.amount_min);
      }
      if (input.filter?.amount_max) {
        query = query.lte('amount', input.filter.amount_max);
      }

      const { data: transactions, error: fetchError } = await query;

      if (fetchError || !transactions || transactions.length === 0) {
        return { summary: 'No matching transactions found.', actions: {} };
      }

      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ category_id: input.category_id, status: 'categorized' })
        .in('id', transactions.map((t: any) => t.id));

      if (updateError) {
        return { summary: `Failed to categorize: ${updateError.message}`, actions: {} };
      }

      const categoryName = categories.find(c => c.id === input.category_id)?.name || 'Unknown';
      return {
        summary: `Categorized ${transactions.length} transaction(s) as "${categoryName}"`,
        actions: { transactions_categorized: transactions.length },
      };
    }

    case 'auto_categorize_all': {
      // Fetch pending transactions
      const { data: transactions } = await supabase
        .from('bank_transactions')
        .select('id, merchant_name, name, personal_finance_category')
        .eq('status', 'pending')
        .gt('amount', 0);

      if (!transactions || transactions.length === 0) {
        return { summary: 'No pending transactions to categorize.', actions: {} };
      }

      let categorized = 0;
      for (const tx of transactions) {
        const descLower = (tx.merchant_name || tx.name || '').toLowerCase();

        // Simple keyword matching
        const categoryKeywords: { [key: string]: string[] } = {
          'software-saas': ['software', 'saas', 'subscription', 'app', 'cloud', 'hosting', 'adobe', 'microsoft', 'google', 'zoom'],
          'data-sources': ['data', 'leads', 'api', 'database'],
          'email-infrastructure': ['email', 'smtp', 'mailgun', 'sendgrid', 'mailchimp'],
          'marketing': ['marketing', 'ads', 'advertising', 'facebook', 'google ads', 'meta'],
          'office-admin': ['office', 'supplies', 'staples', 'amazon'],
          'travel-entertainment': ['travel', 'hotel', 'flight', 'meal', 'restaurant', 'uber', 'lyft'],
          'utilities-comms': ['phone', 'internet', 'utility', 'electric', 'verizon', 'att'],
        };

        for (const [slug, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(kw => descLower.includes(kw))) {
            const cat = categories.find(c => c.slug === slug);
            if (cat) {
              await supabase
                .from('bank_transactions')
                .update({ category_id: cat.id, status: 'categorized' })
                .eq('id', tx.id);
              categorized++;
              break;
            }
          }
        }
      }

      return {
        summary: `Auto-categorized ${categorized} of ${transactions.length} transactions`,
        actions: { transactions_categorized: categorized },
      };
    }

    case 'convert_categorized_to_expenses': {
      const { data: transactions, error: fetchError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('status', 'categorized')
        .gt('amount', 0);

      if (fetchError || !transactions || transactions.length === 0) {
        return { summary: 'No categorized transactions to convert.', actions: {} };
      }

      let converted = 0;
      for (const tx of transactions) {
        const { data: expense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            description: tx.merchant_name || tx.name,
            amount: Math.abs(tx.amount),
            expense_date: tx.date,
            category_id: tx.category_id,
            status: 'pending',
            has_receipt: false,
          })
          .select()
          .single();

        if (!expenseError && expense) {
          // Create overhead allocation
          await supabase.from('expense_allocations').insert({
            expense_id: expense.id,
            is_overhead: true,
            allocation_percentage: 100,
            allocated_amount: Math.abs(tx.amount),
          });

          // Mark transaction as converted
          await supabase
            .from('bank_transactions')
            .update({ status: 'converted' })
            .eq('id', tx.id);

          converted++;
        }
      }

      return {
        summary: `Converted ${converted} transactions to expenses`,
        actions: { expenses_created: converted },
      };
    }

    case 'create_category': {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: newCategory, error } = await supabase
        .from('expense_categories')
        .insert({
          name: input.name,
          slug,
          color: input.color || '#3b82f6',
          description: input.description || null,
          is_tax_deductible: input.is_tax_deductible ?? true,
          is_active: true,
          sort_order: categories.length,
        })
        .select()
        .single();

      if (error) {
        return { summary: `Failed to create category: ${error.message}`, actions: {} };
      }

      return {
        summary: `Created new category: "${input.name}"`,
        actions: { category_created: { id: newCategory.id, name: input.name } },
      };
    }

    case 'update_category': {
      const updates: any = {};
      if (input.name) {
        updates.name = input.name;
        updates.slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      if (input.color) updates.color = input.color;
      if (input.description !== undefined) updates.description = input.description;
      if (input.is_tax_deductible !== undefined) updates.is_tax_deductible = input.is_tax_deductible;

      const { error } = await supabase
        .from('expense_categories')
        .update(updates)
        .eq('id', input.category_id);

      if (error) {
        return { summary: `Failed to update category: ${error.message}`, actions: {} };
      }

      const category = categories.find(c => c.id === input.category_id);
      return {
        summary: `Updated category "${category?.name || 'Unknown'}"`,
        actions: { category_updated: input.category_id },
      };
    }

    case 'get_transaction_summary': {
      const { data: transactions } = await supabase
        .from('bank_transactions')
        .select('merchant_name, name, amount, status')
        .gt('amount', 0)
        .order('amount', { ascending: false });

      if (!transactions || transactions.length === 0) {
        return { summary: 'No transactions found.', actions: {} };
      }

      // Group by merchant
      const byMerchant: { [key: string]: { count: number; total: number } } = {};
      transactions.forEach((tx: any) => {
        const merchant = tx.merchant_name || tx.name || 'Unknown';
        if (!byMerchant[merchant]) {
          byMerchant[merchant] = { count: 0, total: 0 };
        }
        byMerchant[merchant].count++;
        byMerchant[merchant].total += Math.abs(tx.amount);
      });

      const summary = Object.entries(byMerchant)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([merchant, data]) => `- ${merchant}: ${data.count} transaction(s), $${data.total.toFixed(2)}`)
        .join('\n');

      return {
        summary: `**Top merchants by amount:**\n${summary}`,
        actions: {},
      };
    }

    default:
      return { summary: `Unknown tool: ${toolName}`, actions: {} };
  }
}
