import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Target, TrendingUp, Shield, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";

const Index = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="min-h-screen bg-muted/30">
          {/* Top Header with Menu Toggle */}
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-card/95 backdrop-blur-md px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-muted-foreground">Internal Team Access Only</span>
            </div>
          </header>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 py-16">
            {/* Hero */}
            <div className="text-center mb-16">
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

              <Card className="bg-card border-2 border-border hover:border-info/40 hover:shadow-lg transition-all duration-300 rounded-2xl">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-info/10 rounded-xl">
                      <MapPin className="h-6 w-6 text-info" />
                    </div>
                    <CardTitle className="text-foreground">Territory Management</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70 leading-relaxed">
                    Manage ZIP code assignments, visualize territory coverage by state,
                    and track agency distribution across 3,000+ targeted locations.
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
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Index;
