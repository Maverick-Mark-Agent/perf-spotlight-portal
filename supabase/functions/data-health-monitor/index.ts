import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = Deno.env.get('EMAIL_BISON_BASE_URL') || 'https://send.maverickmarketingllc.com/api';
const SUPER_ADMIN_KEY = Deno.env.get('EMAIL_BISON_SUPER_ADMIN_KEY');

interface HealthCheckResult {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    emailBisonAPI: {
      status: 'pass' | 'fail';
      responseTime?: number;
      error?: string;
    };
    cacheHealth: {
      status: 'pass' | 'fail';
      freshCaches: number;
      staleCaches: number;
      errorCaches: number;
    };
    recentAPISuccessRate: {
      status: 'pass' | 'fail';
      successRate: number;
      totalCalls: number;
    };
    validationErrors: {
      status: 'pass' | 'fail';
      criticalErrors: number;
      recentErrors: number;
    };
  };
  healthScore: number;
  issues: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🏥 Starting health check...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const healthResult: HealthCheckResult = {
      timestamp: new Date(),
      overallHealth: 'healthy',
      checks: {
        emailBisonAPI: { status: 'pass' },
        cacheHealth: { status: 'pass', freshCaches: 0, staleCaches: 0, errorCaches: 0 },
        recentAPISuccessRate: { status: 'pass', successRate: 100, totalCalls: 0 },
        validationErrors: { status: 'pass', criticalErrors: 0, recentErrors: 0 }
      },
      healthScore: 100,
      issues: []
    };

    // Check 1: Email Bison API Health
    console.log('✓ Checking Email Bison API...');

    if (!SUPER_ADMIN_KEY) {
      console.warn('⚠️ EMAIL_BISON_SUPER_ADMIN_KEY not configured, skipping API health check');
      healthResult.checks.emailBisonAPI = {
        status: 'fail',
        error: 'API key not configured'
      };
      healthResult.issues.push('Email Bison API key not configured in environment');
      healthResult.healthScore -= 20;
    } else {
      const emailBisonStart = Date.now();
      try {
        const response = await fetch(`${EMAIL_BISON_BASE_URL}/workspaces`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPER_ADMIN_KEY}`,
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

      const responseTime = Date.now() - emailBisonStart;

      if (response.ok) {
        healthResult.checks.emailBisonAPI = {
          status: 'pass',
          responseTime
        };

        if (responseTime > 5000) {
          healthResult.issues.push(`Email Bison API slow: ${responseTime}ms`);
          healthResult.healthScore -= 10;
        }
      } else {
        healthResult.checks.emailBisonAPI = {
          status: 'fail',
          responseTime,
          error: `HTTP ${response.status}`
        };
        healthResult.issues.push(`Email Bison API returned ${response.status}`);
        healthResult.healthScore -= 30;
        healthResult.overallHealth = 'degraded';
      }

      // Log to api_health_logs
      await supabaseClient.from('api_health_logs').insert({
        api_name: 'Email Bison',
        endpoint: '/workspaces',
        status_code: response.status,
        response_time_ms: responseTime,
        success: response.ok,
        error_type: response.ok ? null : `HTTP_${response.status}`,
        timestamp: new Date().toISOString()
      });

      } catch (error) {
        const responseTime = Date.now() - emailBisonStart;
        healthResult.checks.emailBisonAPI = {
          status: 'fail',
          responseTime,
          error: error.message
        };
        healthResult.issues.push(`Email Bison API unreachable: ${error.message}`);
        healthResult.healthScore -= 50;
        healthResult.overallHealth = 'unhealthy';

        // Log error
        await supabaseClient.from('api_health_logs').insert({
          api_name: 'Email Bison',
          endpoint: '/workspaces',
          status_code: null,
          response_time_ms: responseTime,
          success: false,
          error_type: error.name || 'NETWORK_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check 2: Cache Health
    console.log('✓ Checking cache health...');
    const { data: cacheData, error: cacheError } = await supabaseClient
      .from('data_cache_metadata')
      .select('*');

    if (cacheError) {
      console.error('Error fetching cache metadata:', cacheError);
      healthResult.checks.cacheHealth.status = 'fail';
      healthResult.healthScore -= 20;
    } else if (cacheData) {
      const freshCaches = cacheData.filter(c => c.status === 'fresh').length;
      const staleCaches = cacheData.filter(c => c.status === 'stale').length;
      const errorCaches = cacheData.filter(c => c.status === 'error').length;

      healthResult.checks.cacheHealth = {
        status: errorCaches > 0 ? 'fail' : 'pass',
        freshCaches,
        staleCaches,
        errorCaches
      };

      if (errorCaches > 0) {
        healthResult.issues.push(`${errorCaches} cache(s) in error state`);
        healthResult.healthScore -= 15;
        healthResult.overallHealth = 'degraded';
      }

      if (staleCaches > 2) {
        healthResult.issues.push(`${staleCaches} cache(s) are stale`);
        healthResult.healthScore -= 5;
      }
    }

    // Check 3: Recent API Success Rate
    console.log('✓ Checking recent API success rate...');
    const { data: recentAPICalls, error: apiError } = await supabaseClient
      .from('api_health_logs')
      .select('success')
      .gte('timestamp', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Last 15 minutes
      .eq('api_name', 'Email Bison');

    if (apiError) {
      console.error('Error fetching API health logs:', apiError);
    } else if (recentAPICalls && recentAPICalls.length > 0) {
      const successfulCalls = recentAPICalls.filter(c => c.success).length;
      const totalCalls = recentAPICalls.length;
      const successRate = (successfulCalls / totalCalls) * 100;

      healthResult.checks.recentAPISuccessRate = {
        status: successRate >= 90 ? 'pass' : 'fail',
        successRate: Math.round(successRate),
        totalCalls
      };

      if (successRate < 90) {
        healthResult.issues.push(`Low API success rate: ${Math.round(successRate)}%`);
        healthResult.healthScore -= 20;
        healthResult.overallHealth = 'degraded';
      }

      if (successRate < 50) {
        healthResult.overallHealth = 'unhealthy';
      }
    }

    // Check 4: Validation Errors
    console.log('✓ Checking validation errors...');
    const { data: validationErrors, error: validationError } = await supabaseClient
      .from('data_validation_errors')
      .select('severity')
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    if (validationError) {
      console.error('Error fetching validation errors:', validationError);
    } else if (validationErrors) {
      const criticalErrors = validationErrors.filter(e => e.severity === 'critical').length;
      const totalErrors = validationErrors.length;

      healthResult.checks.validationErrors = {
        status: criticalErrors > 0 ? 'fail' : 'pass',
        criticalErrors,
        recentErrors: totalErrors
      };

      if (criticalErrors > 0) {
        healthResult.issues.push(`${criticalErrors} critical validation error(s) in last hour`);
        healthResult.healthScore -= 25;
        healthResult.overallHealth = 'degraded';
      }

      if (totalErrors > 10) {
        healthResult.issues.push(`High validation error count: ${totalErrors} in last hour`);
        healthResult.healthScore -= 10;
      }
    }

    // Determine overall health based on score
    if (healthResult.healthScore >= 80) {
      healthResult.overallHealth = 'healthy';
    } else if (healthResult.healthScore >= 50) {
      healthResult.overallHealth = 'degraded';
    } else {
      healthResult.overallHealth = 'unhealthy';
    }

    console.log(`✅ Health check complete. Overall: ${healthResult.overallHealth}, Score: ${healthResult.healthScore}`);

    if (healthResult.issues.length > 0) {
      console.log('⚠️ Issues detected:');
      healthResult.issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return new Response(
      JSON.stringify(healthResult, null, 2),
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
        overallHealth: 'unhealthy'
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
