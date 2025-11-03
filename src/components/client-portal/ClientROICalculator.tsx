import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DollarSign,
  TrendingUp,
  Percent,
  Target,
  TrendingDown,
  Calculator,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CLIENT_METRICS } from "@/constants/pricing";

interface ClientLead {
  id: string;
  pipeline_stage: string;
  premium_amount: number | null;
  lead_value: number;
}

interface ClientROICalculatorProps {
  workspaceName: string;
  leads: ClientLead[];
}

interface ClientSettings {
  cost_per_lead: number;
  default_commission_rate: number;
}

export const ClientROICalculator = ({ workspaceName, leads }: ClientROICalculatorProps) => {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [commissionRate, setCommissionRate] = useState(10); // User-editable commission %
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientSettings();
  }, [workspaceName]);

  const fetchClientSettings = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('client_settings')
        .select('cost_per_lead, default_commission_rate')
        .eq('workspace_name', workspaceName)
        .single();

      if (error) {
        console.error('Error fetching client settings:', error);
        // Use defaults if not found
        setSettings({
          cost_per_lead: DEFAULT_CLIENT_METRICS.COST_PER_LEAD,
          default_commission_rate: DEFAULT_CLIENT_METRICS.COMMISSION_RATE
        });
        setCommissionRate(DEFAULT_CLIENT_METRICS.COMMISSION_RATE);
      } else {
        const settingsData = data || {
          cost_per_lead: DEFAULT_CLIENT_METRICS.COST_PER_LEAD,
          default_commission_rate: DEFAULT_CLIENT_METRICS.COMMISSION_RATE
        };
        setSettings(settingsData);
        setCommissionRate(settingsData.default_commission_rate);
      }
    } catch (error) {
      console.error('Error fetching client settings:', error);
      setSettings({
        cost_per_lead: DEFAULT_CLIENT_METRICS.COST_PER_LEAD,
        default_commission_rate: DEFAULT_CLIENT_METRICS.COMMISSION_RATE
      });
      setCommissionRate(DEFAULT_CLIENT_METRICS.COMMISSION_RATE);
    } finally {
      setLoading(false);
    }
  };

  // Calculate ROI metrics from actual data
  const metrics = useMemo(() => {
    if (!settings) return null;

    // Count won leads
    const wonLeads = leads.filter(lead => lead.pipeline_stage === 'won');
    const totalLeads = leads.length;

    // Calculate total premium revenue from won deals
    const totalPremiumRevenue = wonLeads.reduce((sum, lead) => {
      return sum + (lead.premium_amount || 0);
    }, 0);

    // Calculate commission revenue (what client earns)
    const commissionRevenue = totalPremiumRevenue * (commissionRate / 100);

    // Calculate total cost (all leads × cost per lead)
    const totalCost = totalLeads * settings.cost_per_lead;

    // Calculate profit and ROI
    const profit = commissionRevenue - totalCost;
    const roiPercentage = totalCost > 0 ? ((profit / totalCost) * 100) : 0;

    // Calculate average premium per won deal
    const avgPremiumPerDeal = wonLeads.length > 0 ? totalPremiumRevenue / wonLeads.length : 0;

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;

    // Calculate cost per acquisition
    const costPerAcquisition = wonLeads.length > 0 ? totalCost / wonLeads.length : 0;

    // Determine if we should show encouraging placeholders
    const hasLowMetrics = wonLeads.length === 0 || totalPremiumRevenue === 0;
    const hasNegativeROI = roiPercentage < 0;

    return {
      wonLeads: wonLeads.length,
      totalLeads,
      totalPremiumRevenue,
      commissionRevenue,
      totalCost,
      profit,
      roiPercentage,
      avgPremiumPerDeal,
      conversionRate,
      costPerAcquisition,
      costPerLead: settings.cost_per_lead,
      hasLowMetrics,
      hasNegativeROI,
    };
  }, [leads, settings, commissionRate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">ROI Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-white/10 rounded"></div>
            <div className="h-20 bg-white/10 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  // Show encouraging empty state if no won deals yet
  if (metrics.hasLowMetrics) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-purple-400" />
            Your ROI Potential
          </CardTitle>
          <p className="text-white/60 text-sm">
            You have {metrics.totalLeads} leads in your pipeline - great start! 🚀
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-lg p-6 text-center">
            <div className="mb-4">
              <TrendingUp className="h-12 w-12 text-blue-400 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Building Your Pipeline</h3>
            <p className="text-white/70 text-sm mb-4">
              Move leads to "Won" and add their premium amounts to see your ROI metrics here
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-white/60 text-xs mb-1">Active Leads</p>
                <p className="text-2xl font-bold text-blue-400">{metrics.totalLeads}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-white/60 text-xs mb-1">Potential</p>
                <p className="text-2xl font-bold text-purple-400">High</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-white/60 text-xs mb-1">Next Step</p>
                <p className="text-sm font-bold text-green-400">Close Deals!</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Calculator className="h-5 w-5 text-purple-400" />
          Your ROI from Maverick {metrics.roiPercentage >= 0 ? '✨' : ''}
        </CardTitle>
        <p className="text-white/60 text-sm">
          {metrics.wonLeads > 0 && `${metrics.wonLeads} won deals out of ${metrics.totalLeads} total leads - ${metrics.wonLeads === 1 ? "Great start!" : "Keep it up!"}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main ROI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium mb-1">Premium Volume</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(metrics.totalPremiumRevenue)}</p>
                <p className="text-white/50 text-xs mt-1">Total premiums</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          {/* Commission Revenue */}
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium mb-1">Your Revenue</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(metrics.commissionRevenue)}</p>
                <p className="text-white/50 text-xs mt-1">At {commissionRate}% commission</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </div>

          {/* ROI */}
          <div className={`bg-gradient-to-br ${metrics.roiPercentage >= 0 ? 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30' : 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30'} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium mb-1">ROI</p>
                {metrics.roiPercentage >= 0 ? (
                  <>
                    <p className="text-2xl font-bold text-green-400">
                      {formatPercent(metrics.roiPercentage)}
                    </p>
                    <p className="text-white/50 text-xs mt-1">Profitable! 🎉</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-yellow-400">
                      Building
                    </p>
                    <p className="text-white/50 text-xs mt-1">More wins needed</p>
                  </>
                )}
              </div>
              {metrics.roiPercentage >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-400" />
              ) : (
                <Target className="h-8 w-8 text-yellow-400" />
              )}
            </div>
          </div>

          {/* Profit */}
          <div className={`bg-gradient-to-br ${metrics.profit >= 0 ? 'from-purple-500/20 to-purple-600/20 border-purple-500/30' : 'from-blue-500/20 to-blue-600/20 border-blue-500/30'} border rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-medium mb-1">Net Profit</p>
                {metrics.profit >= 0 ? (
                  <>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(metrics.profit)}
                    </p>
                    <p className="text-white/50 text-xs mt-1">Revenue - costs</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-blue-400">
                      Growing
                    </p>
                    <p className="text-white/50 text-xs mt-1">Keep closing!</p>
                  </>
                )}
              </div>
              <Target className={`h-8 w-8 ${metrics.profit >= 0 ? 'text-purple-400' : 'text-blue-400'}`} />
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-white font-semibold mb-4 text-sm">Cost Breakdown</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-white/60 text-xs mb-2">Total Cost</p>
              <p className="text-xl font-bold text-white">{formatCurrency(metrics.totalCost)}</p>
              <p className="text-white/50 text-xs mt-1">
                {metrics.totalLeads} leads × {formatCurrency(metrics.costPerLead)}/lead
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-white/60 text-xs mb-2">Cost Per Acquisition</p>
              <p className="text-xl font-bold text-white">{formatCurrency(metrics.costPerAcquisition)}</p>
              <p className="text-white/50 text-xs mt-1">
                Per won deal
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <p className="text-white/60 text-xs mb-2">Conversion Rate</p>
              <p className="text-xl font-bold text-white">{formatPercent(metrics.conversionRate)}</p>
              <p className="text-white/50 text-xs mt-1">
                {metrics.wonLeads} won / {metrics.totalLeads} total
              </p>
            </div>
          </div>
        </div>

        {/* Commission Rate Adjuster */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-white font-semibold mb-4 text-sm">Adjust Your Commission Rate</h4>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="space-y-3">
              <Label htmlFor="commission-rate" className="text-white text-sm font-medium">
                Commission Rate (%)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="commission-rate"
                  type="number"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  className="w-24 bg-white/10 border-white/20 text-white"
                  min="0"
                  max="100"
                  step="0.5"
                />
                <Slider
                  value={[commissionRate]}
                  onValueChange={([value]) => setCommissionRate(value)}
                  min={0}
                  max={100}
                  step={0.5}
                  className="flex-1"
                />
                <div className="text-white/60 text-sm min-w-[120px]">
                  = {formatCurrency(metrics.totalPremiumRevenue * (commissionRate / 100))}
                </div>
              </div>
              <p className="text-white/50 text-xs">
                Adjust to see how different commission rates affect your ROI
              </p>
            </div>
          </div>
        </div>

        {/* Per Deal Metrics */}
        <div className="border-t border-white/10 pt-6">
          <h4 className="text-white font-semibold mb-4 text-sm">Average Deal Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 border border-indigo-500/30 rounded-lg p-4">
              <p className="text-white/60 text-xs mb-2">Avg Premium per Deal</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(metrics.avgPremiumPerDeal)}</p>
              <p className="text-white/50 text-xs mt-1">
                Based on {metrics.wonLeads} won deals
              </p>
            </div>

            <div className="bg-gradient-to-br from-teal-500/20 to-teal-600/20 border border-teal-500/30 rounded-lg p-4">
              <p className="text-white/60 text-xs mb-2">Avg Commission per Deal</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(metrics.avgPremiumPerDeal * (commissionRate / 100))}
              </p>
              <p className="text-white/50 text-xs mt-1">
                At {commissionRate}% commission
              </p>
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <p className="text-white/80 text-xs">
            <span className="font-semibold">Note:</span> Cost per lead ({formatCurrency(metrics.costPerLead)}) is managed by Maverick.
            Adjust your commission rate above to see how it impacts your ROI.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
