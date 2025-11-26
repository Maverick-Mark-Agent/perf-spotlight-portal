import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface Attachment {
  file_name: string;
  file_type: string;
  base64_content: string;
}

interface ChatRequest {
  session_id?: string;
  message: string;
  attachments?: Attachment[];
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathname = url.pathname.replace('/ai-expense-assistant', '');

    // Route handling
    if (pathname === '/chat' || pathname === '') {
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
  const { session_id, message, attachments } = request;

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

  // Fetch context: categories, vendors, recent expenses
  const [categoriesRes, vendorsRes, expensesRes] = await Promise.all([
    supabase.from('expense_categories').select('id, name, slug').eq('is_active', true),
    supabase.from('vendors').select('id, name, display_name, category_id').eq('is_active', true),
    supabase.from('expenses').select('id, description, amount, expense_date, vendor_id, category_id').order('created_at', { ascending: false }).limit(20),
  ]);

  const categories = categoriesRes.data || [];
  const vendors = vendorsRes.data || [];
  const recentExpenses = expensesRes.data || [];

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
    // General chat - use Claude to understand intent and respond
    responseMessage = await handleGeneralChat(message, categories, vendors, recentExpenses);
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

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Content,
            },
          },
          {
            type: 'text',
            text: `Extract all transactions from this bank statement. Return a JSON array with each transaction having:
- date (YYYY-MM-DD format)
- description (merchant/payee name)
- amount (positive number)
- type ("debit" for expenses, "credit" for deposits)

Only include actual transactions, not balances or summaries. Return ONLY the JSON array, no other text.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    console.error('Claude API error:', await response.text());
    return [];
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || '';

  try {
    // Try to parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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
  recentExpenses: any[]
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return "I'm sorry, but the AI service is not configured. Please contact your administrator.";
  }

  const systemPrompt = `You are an expense tracking assistant for a business dashboard. You help users:
- Upload and process bank statements (CSV or PDF)
- Upload receipts and match them to expenses
- Categorize expenses
- Answer questions about their expenses

Available expense categories: ${categories.map(c => c.name).join(', ')}
Known vendors: ${vendors.map(v => v.name).join(', ')}

Recent expenses for context:
${recentExpenses.slice(0, 5).map(e => `- ${e.description}: $${e.amount} on ${e.expense_date}`).join('\n')}

Keep responses concise and helpful. If the user wants to upload files, explain that they can drag and drop files into the chat.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
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
  return result.content?.[0]?.text || "I'm not sure how to help with that. Try uploading a bank statement or receipt!";
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
    parts.push("No transactions found to import. Please check the file format.");
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
