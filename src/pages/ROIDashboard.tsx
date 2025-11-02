import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DollarSign,
  TrendingUp,
  Users,
  ArrowLeft,
  Target,
  Percent,
  Calendar,
  CircleDollarSign
} from "lucide-react";
import { ROI_DEFAULTS } from "@/constants/pricing";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/navigation";

const ROIDashboard = () => {
  // Input states
  const [monthlyLeads, setMonthlyLeads] = useState<number>(ROI_DEFAULTS.MONTHLY_LEADS);
  const [costPerLead, setCostPerLead] = useState<number>(ROI_DEFAULTS.COST_PER_LEAD);
  const [conversionRate, setConversionRate] = useState<number>(ROI_DEFAULTS.CONVERSION_RATE);
  const [avgDealSize, setAvgDealSize] = useState<number>(ROI_DEFAULTS.AVG_DEAL_SIZE);
  const [customerLTV, setCustomerLTV] = useState<number>(ROI_DEFAULTS.CUSTOMER_LTV);
  const [monthlyOperatingCosts, setMonthlyOperatingCosts] = useState<number>(ROI_DEFAULTS.MONTHLY_OPERATING_COSTS);

  // Calculated metrics
  const metrics = useMemo(() => {
    const customersAcquired = Math.round((monthlyLeads * conversionRate) / 100);
    const totalLeadCost = monthlyLeads * costPerLead;
    const totalCosts = totalLeadCost + monthlyOperatingCosts;
    const monthlyRevenue = customersAcquired * avgDealSize;
    const totalLTVRevenue = customersAcquired * customerLTV;
    const monthlyProfit = monthlyRevenue - totalCosts;
    const roiPercentage = totalCosts > 0 ? ((monthlyProfit / totalCosts) * 100) : 0;
    const paybackPeriod = monthlyProfit > 0 ? totalCosts / monthlyProfit : 0;
    const yearlyRevenue = monthlyRevenue * 12;
    const yearlyProfit = monthlyProfit * 12;
    const yearlyCustomers = customersAcquired * 12;

    return {
      customersAcquired,
      totalLeadCost,
      totalCosts,
      monthlyRevenue,
      totalLTVRevenue,
      monthlyProfit,
      roiPercentage,
      paybackPeriod,
      yearlyRevenue,
      yearlyProfit,
      yearlyCustomers
    };
  }, [monthlyLeads, costPerLead, conversionRate, avgDealSize, customerLTV, monthlyOperatingCosts]);

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

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.HOME}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">ROI Calculator</h1>
                  <p className="text-sm text-muted-foreground">Project your lead generation returns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Input Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Campaign Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Monthly Leads */}
              <div className="space-y-3">
                <Label htmlFor="monthly-leads" className="text-base font-semibold">
                  Monthly Leads
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="monthly-leads"
                    type="number"
                    value={monthlyLeads}
                    onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[monthlyLeads]}
                    onValueChange={([value]) => setMonthlyLeads(value)}
                    min={10}
                    max={1000}
                    step={10}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Cost Per Lead */}
              <div className="space-y-3">
                <Label htmlFor="cost-per-lead" className="text-base font-semibold">
                  Cost Per Lead ($)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="cost-per-lead"
                    type="number"
                    value={costPerLead}
                    onChange={(e) => setCostPerLead(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[costPerLead]}
                    onValueChange={([value]) => setCostPerLead(value)}
                    min={5}
                    max={500}
                    step={5}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="space-y-3">
                <Label htmlFor="conversion-rate" className="text-base font-semibold">
                  Conversion Rate (%)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="conversion-rate"
                    type="number"
                    value={conversionRate}
                    onChange={(e) => setConversionRate(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[conversionRate]}
                    onValueChange={([value]) => setConversionRate(value)}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Average Deal Size */}
              <div className="space-y-3">
                <Label htmlFor="avg-deal-size" className="text-base font-semibold">
                  Average Deal Size ($)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="avg-deal-size"
                    type="number"
                    value={avgDealSize}
                    onChange={(e) => setAvgDealSize(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[avgDealSize]}
                    onValueChange={([value]) => setAvgDealSize(value)}
                    min={100}
                    max={10000}
                    step={100}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Customer LTV */}
              <div className="space-y-3">
                <Label htmlFor="customer-ltv" className="text-base font-semibold">
                  Customer Lifetime Value ($)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="customer-ltv"
                    type="number"
                    value={customerLTV}
                    onChange={(e) => setCustomerLTV(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[customerLTV]}
                    onValueChange={([value]) => setCustomerLTV(value)}
                    min={100}
                    max={20000}
                    step={100}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Monthly Operating Costs */}
              <div className="space-y-3">
                <Label htmlFor="operating-costs" className="text-base font-semibold">
                  Monthly Operating Costs ($)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="operating-costs"
                    type="number"
                    value={monthlyOperatingCosts}
                    onChange={(e) => setMonthlyOperatingCosts(Number(e.target.value))}
                    className="w-24"
                  />
                  <Slider
                    value={[monthlyOperatingCosts]}
                    onValueChange={([value]) => setMonthlyOperatingCosts(value)}
                    min={0}
                    max={20000}
                    step={100}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Metrics */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Monthly Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Customers Acquired</p>
                    <p className="text-3xl font-bold text-foreground">{metrics.customersAcquired}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(metrics.monthlyRevenue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">ROI</p>
                    <p className={`text-3xl font-bold ${metrics.roiPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatPercent(metrics.roiPercentage)}
                    </p>
                  </div>
                  <Percent className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-orange-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Payback Period</p>
                    <p className="text-3xl font-bold text-foreground">
                      {metrics.paybackPeriod > 0 ? `${metrics.paybackPeriod.toFixed(1)}mo` : 'N/A'}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Cost Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Lead Acquisition Cost</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.totalLeadCost)}</p>
                  </div>
                  <Target className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Total Monthly Costs</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.totalCosts)}</p>
                  </div>
                  <CircleDollarSign className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Monthly Profit</p>
                    <p className={`text-2xl font-bold ${metrics.monthlyProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(metrics.monthlyProfit)}
                    </p>
                  </div>
                  <TrendingUp className={`h-8 w-8 ${metrics.monthlyProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Yearly Projections */}
        <div>
          <h2 className="text-xl font-bold mb-4">Yearly Projections</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border-indigo-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Annual Customers</p>
                    <p className="text-3xl font-bold text-foreground">{metrics.yearlyCustomers}</p>
                  </div>
                  <Users className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Annual Revenue</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(metrics.yearlyRevenue)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/10 border-teal-500/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Annual Profit</p>
                    <p className={`text-3xl font-bold ${metrics.yearlyProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(metrics.yearlyProfit)}
                    </p>
                  </div>
                  <TrendingUp className={`h-8 w-8 ${metrics.yearlyProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIDashboard;
