import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Target, TrendingUp, Shield, Zap, Clock, Building } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Maverick Marketing
                </h1>
                <p className="text-sm text-muted-foreground font-medium">Internal Analytics Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="px-3 py-1.5 bg-success/10 border border-success/40 rounded-full">
                <span className="text-xs font-semibold text-success">● Live Data</span>
              </div>
              <Button asChild variant="outline" className="shadow-sm hover:shadow-md transition-all">
                <Link to="/kpi-dashboard">KPI Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="shadow-sm hover:shadow-md transition-all">
                <Link to="/email-accounts">Infrastructure</Link>
              </Button>
              <Button asChild variant="outline" className="shadow-sm hover:shadow-md transition-all">
                <Link to="/volume-dashboard">Volume Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="shadow-sm hover:shadow-md transition-all">
                <Link to="/billing">Billing Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Main Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-info/10 backdrop-blur-sm rounded-full border border-info/40 mb-6">
            <Shield className="h-4 w-4 text-info" />
            <span className="text-sm font-semibold text-info">Internal Team Access Only</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-foreground">
            Client Performance
            <br />
            <span className="text-primary">Command Center</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Real-time analytics dashboard for monitoring client campaigns, lead generation performance, 
            and team productivity across all Maverick Marketing initiatives.
          </p>
        </div>


        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="bg-card border-2 border-border hover:border-success/40 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-success/10 rounded-xl">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-foreground">Lead Generation Tracking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/70 leading-relaxed">
                Monitor monthly lead generation progress across all client campaigns with 
                real-time updates, visual progress indicators, and conversion analytics.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-border hover:border-primary/40 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-foreground">KPI Management Suite</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/70 leading-relaxed">
                Track key performance indicators and compare against monthly targets 
                with detailed analytics, trend analysis, and predictive insights.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-2 border-border hover:border-warning/40 hover:shadow-lg transition-all duration-300 rounded-2xl">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-warning/10 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-warning" />
                </div>
                <CardTitle className="text-foreground">Advanced Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/70 leading-relaxed">
                Deep-dive into performance metrics with customizable time periods, 
                comparative analysis, and actionable insights for strategic decisions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5 backdrop-blur-sm border-2 border-primary/20 rounded-3xl p-12 shadow-lg">
            <h3 className="text-3xl font-bold text-foreground mb-4">Ready to Analyze Performance?</h3>
            <p className="text-foreground/70 mb-8 max-w-2xl mx-auto leading-relaxed">
              Access comprehensive client performance metrics, lead generation analytics, and strategic insights 
              to drive Maverick Marketing's continued success.
            </p>
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl">
              <Link to="/kpi-dashboard">
                <TrendingUp className="h-5 w-5 mr-2" />
                Launch KPI Dashboard
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-6">
              <Shield className="inline h-4 w-4 mr-1" />
              Secure • Real-time • Airtable Integration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
