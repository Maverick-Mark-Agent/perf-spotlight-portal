import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  timestamp: string;
  overall_health: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    webhook_function: {
      status: 'pass' | 'fail';
      response_time_ms?: number;
      error?: string;
    };
    test_lead_creation: {
      status: 'pass' | 'fail';
      lead_id?: string;
      error?: string;
    };
    recent_lead_activity: {
      status: 'pass' | 'fail';
      leads_last_24h: number;
      clients_with_leads: number;
      clients_without_leads: string[];
    };
  };
  health_score: number;
  issues: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🏥 Starting daily webhook health check...');

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      overall_health: 'healthy',
      checks: {
        webhook_function: { status: 'pass' },
        test_lead_creation: { status: 'pass' },
        recent_lead_activity: {
          status: 'pass',
          leads_last_24h: 0,
          clients_with_leads: 0,
          clients_without_leads: []
        }
      },
      health_score: 100,
      issues: []
    };

    // Check 1: Test webhook function accessibility
    console.log('✓ Testing webhook function...');
    const webhookStart = Date.now();

    try {
      const testResponse = await fetch(
        'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true }),
          signal: AbortSignal.timeout(10000)
        }
      );

      const responseTime = Date.now() - webhookStart;

      if (testResponse.status === 400) {
        // Expected: function rejects test payload but is accessible
        result.checks.webhook_function = {
          status: 'pass',
          response_time_ms: responseTime
        };
      } else if (testResponse.status === 401) {
        // JWT verification enabled - critical error
        result.checks.webhook_function = {
          status: 'fail',
          response_time_ms: responseTime,
          error: 'JWT verification is enabled (401 error)'
        };
        result.issues.push('❌ CRITICAL: Webhook function has JWT verification enabled');
        result.health_score -= 50;
        result.overall_health = 'unhealthy';
      } else {
        result.checks.webhook_function = {
          status: 'pass',
          response_time_ms: responseTime
        };
      }

      if (responseTime > 5000) {
        result.issues.push(`Webhook function slow: ${responseTime}ms`);
        result.health_score -= 10;
      }

    } catch (error) {
      result.checks.webhook_function = {
        status: 'fail',
        error: error.message
      };
      result.issues.push(`Webhook function unreachable: ${error.message}`);
      result.health_score -= 50;
      result.overall_health = 'unhealthy';
    }

    // Check 2: Test lead creation
    console.log('✓ Testing lead creation...');

    if (result.checks.webhook_function.status === 'pass') {
      const testEmail = `health-check-${Date.now()}@example.com`;

      try {
        const createResponse = await fetch(
          'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: {
                type: 'LEAD_INTERESTED',
                workspace_name: 'Health Check Test',
                workspace_id: 9999,
                instance_url: 'https://app.emailbison.com'
              },
              data: {
                lead: {
                  id: 999999,
                  email: testEmail,
                  first_name: 'Health',
                  last_name: 'Check',
                  status: 'interested',
                  title: 'Test',
                  company: 'Test Co',
                  custom_variables: []
                },
                reply: {
                  id: 99999,
                  uuid: 'health-check-uuid',
                  date_received: new Date().toISOString(),
                  from_name: 'Health Check',
                  from_email_address: testEmail
                },
                campaign: { id: 999, name: 'Health Check' },
                sender_email: { id: 999, email: 'test@test.com', name: 'Test' }
              }
            })
          }
        );

        if (createResponse.ok) {
          const createData = await createResponse.json();

          result.checks.test_lead_creation = {
            status: 'pass',
            lead_id: createData.lead_id
          };

          // Cleanup test lead
          await supabaseClient
            .from('client_leads')
            .delete()
            .eq('id', createData.lead_id);

        } else {
          const errorText = await createResponse.text();
          result.checks.test_lead_creation = {
            status: 'fail',
            error: `HTTP ${createResponse.status}: ${errorText}`
          };
          result.issues.push('Test lead creation failed');
          result.health_score -= 25;
          result.overall_health = 'degraded';
        }

      } catch (error) {
        result.checks.test_lead_creation = {
          status: 'fail',
          error: error.message
        };
        result.issues.push(`Lead creation test error: ${error.message}`);
        result.health_score -= 25;
      }
    }

    // Check 3: Recent lead activity
    console.log('✓ Checking recent lead activity...');

    const { data: recentLeads, error: leadsError } = await supabaseClient
      .from('client_leads')
      .select('workspace_name, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('Error fetching recent leads:', leadsError);
      result.issues.push('Failed to query recent leads');
      result.health_score -= 15;
    } else if (recentLeads) {
      const leadsByWorkspace = recentLeads.reduce((acc, lead) => {
        acc[lead.workspace_name] = (acc[lead.workspace_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      result.checks.recent_lead_activity = {
        status: 'pass',
        leads_last_24h: recentLeads.length,
        clients_with_leads: Object.keys(leadsByWorkspace).length,
        clients_without_leads: []
      };

      // Check high-volume clients
      const expectedActiveClients = [
        'Kim Wallace',
        'John Roberts',
        'Danny Schwartz',
        'Devin Hodo',
        'David Amiri'
      ];

      const clientsWithoutLeads = expectedActiveClients.filter(
        client => !leadsByWorkspace[client]
      );

      if (clientsWithoutLeads.length > 0) {
        result.checks.recent_lead_activity.clients_without_leads = clientsWithoutLeads;
        result.checks.recent_lead_activity.status = 'fail';
        result.issues.push(`${clientsWithoutLeads.length} active client(s) with no leads in 24h: ${clientsWithoutLeads.join(', ')}`);
        result.health_score -= 10;
        result.overall_health = result.overall_health === 'healthy' ? 'degraded' : result.overall_health;
      }

      console.log(`  ${recentLeads.length} leads in last 24 hours`);
      console.log(`  ${Object.keys(leadsByWorkspace).length} clients with activity`);
    }

    // Determine overall health based on score
    if (result.health_score >= 80) {
      result.overall_health = 'healthy';
    } else if (result.health_score >= 50) {
      result.overall_health = 'degraded';
    } else {
      result.overall_health = 'unhealthy';
    }

    console.log(`✅ Health check complete. Status: ${result.overall_health}, Score: ${result.health_score}`);

    if (result.issues.length > 0) {
      console.log('⚠️ Issues detected:');
      result.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // TODO: Send Slack alert if unhealthy
    // if (result.overall_health !== 'healthy') {
    //   await sendSlackAlert(result);
    // }

    return new Response(
      JSON.stringify(result, null, 2),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Health check failed:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        overall_health: 'unhealthy',
        health_score: 0
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    );
  }
});
