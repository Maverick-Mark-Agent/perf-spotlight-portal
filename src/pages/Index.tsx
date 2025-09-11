import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Target, TrendingUp, Shield, Zap, Clock, Building } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-dashboard">
      {/* Navigation */}
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-dashboard-primary to-dashboard-accent rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-dashboard-success rounded-full animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-dashboard-primary bg-clip-text text-transparent">
                  Maverick Marketing
                </h1>
                <p className="text-sm text-white/70 font-medium">Internal Analytics Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="px-3 py-1 bg-dashboard-success/20 border border-dashboard-success/40 rounded-full">
                <span className="text-xs font-medium text-dashboard-success">● Live Data</span>
              </div>
              <Button asChild variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Link to="/kpi-progress">KPI Dashboard</Link>
              </Button>
              <Button asChild variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Link to="/sending-accounts">Infrastructure</Link>
              </Button>
              <Button asChild variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                <Link to="/sending-volume">Volume Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Main Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <Shield className="h-4 w-4 text-dashboard-success" />
            <span className="text-sm font-medium text-white">Internal Team Access Only</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-dashboard-primary to-white bg-clip-text text-transparent">
              Client Performance
            </span>
            <br />
            <span className="text-white/90">Command Center</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto leading-relaxed">
            Real-time analytics dashboard for monitoring client campaigns, lead generation performance, 
            and team productivity across all Maverick Marketing initiatives.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Building className="h-8 w-8 text-dashboard-primary" />
              <span className="text-2xl font-bold text-white">25+</span>
            </div>
            <p className="text-white/70 font-medium">Active Clients</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Users className="h-8 w-8 text-dashboard-success" />
              <span className="text-2xl font-bold text-white">1.2K+</span>
            </div>
            <p className="text-white/70 font-medium">Leads This Month</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="h-8 w-8 text-dashboard-warning" />
              <span className="text-2xl font-bold text-white">94.2%</span>
            </div>
            <p className="text-white/70 font-medium">Target Achievement</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Clock className="h-8 w-8 text-dashboard-accent" />
              <span className="text-2xl font-bold text-white">Real-time</span>
            </div>
            <p className="text-white/70 font-medium">Data Updates</p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-dashboard-success/20 rounded-lg">
                  <Users className="h-6 w-6 text-dashboard-success" />
                </div>
                <CardTitle className="text-white">Lead Generation Tracking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 leading-relaxed">
                Monitor monthly lead generation progress across all client campaigns with 
                real-time updates, visual progress indicators, and conversion analytics.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-dashboard-primary/20 rounded-lg">
                  <Target className="h-6 w-6 text-dashboard-primary" />
                </div>
                <CardTitle className="text-white">KPI Management Suite</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 leading-relaxed">
                Track key performance indicators and compare against monthly targets 
                with detailed analytics, trend analysis, and predictive insights.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-dashboard-warning/20 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-dashboard-warning" />
                </div>
                <CardTitle className="text-white">Advanced Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 leading-relaxed">
                Deep-dive into performance metrics with customizable time periods, 
                comparative analysis, and actionable insights for strategic decisions.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-dashboard-primary/20 via-dashboard-accent/20 to-dashboard-primary/20 backdrop-blur-sm border border-white/20 rounded-3xl p-12">
            <h3 className="text-3xl font-bold text-white mb-4">Ready to Analyze Performance?</h3>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              Access comprehensive client performance metrics, lead generation analytics, and strategic insights 
              to drive Maverick Marketing's continued success.
            </p>
            <Button asChild size="lg" className="bg-gradient-to-r from-dashboard-primary to-dashboard-accent hover:from-dashboard-accent hover:to-dashboard-primary text-white px-12 py-4 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300">
              <Link to="/kpi-progress">
                Launch KPI Dashboard
              </Link>
            </Button>
            <p className="text-sm text-white/60 mt-6">
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
