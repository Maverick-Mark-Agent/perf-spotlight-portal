import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-dashboard-bg">
      {/* Navigation */}
      <nav className="bg-dashboard-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-dashboard-accent" />
              <h1 className="text-xl font-bold text-dashboard-primary">
                Performance Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button asChild variant="default" className="bg-dashboard-accent hover:bg-dashboard-primary">
                <Link to="/kpi-progress">View KPI Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-dashboard-primary mb-4">
            Client Performance Management Portal
          </h1>
          <p className="text-xl text-dashboard-secondary max-w-2xl mx-auto">
            Track lead generation, monitor KPIs, and analyze positive reply metrics 
            across all your clients in one centralized dashboard.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="bg-dashboard-card border-border hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-dashboard-accent" />
                <CardTitle className="text-dashboard-primary">Lead Tracking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-dashboard-secondary">
                Monitor monthly lead generation progress with real-time updates 
                and visual progress indicators.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-dashboard-card border-border hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Target className="h-6 w-6 text-dashboard-success" />
                <CardTitle className="text-dashboard-primary">KPI Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-dashboard-secondary">
                Track key performance indicators and compare against monthly 
                targets with detailed analytics.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-dashboard-card border-border hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-dashboard-warning" />
                <CardTitle className="text-dashboard-primary">Performance Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-dashboard-secondary">
                Analyze positive reply trends with customizable time periods 
                and comparative metrics.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Button asChild size="lg" className="bg-dashboard-accent hover:bg-dashboard-primary text-white px-8 py-3">
            <Link to="/kpi-progress">
              Access Monthly KPI Dashboard
            </Link>
          </Button>
          <p className="text-sm text-dashboard-secondary mt-4">
            Connected to Airtable for real-time data synchronization
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
