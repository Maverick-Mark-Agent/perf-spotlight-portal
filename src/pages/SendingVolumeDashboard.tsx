import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target } from "lucide-react";
import { Link } from "react-router-dom";

const SendingVolumeDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-dashboard">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Portal
                </Link>
              </Button>
              <div className="h-6 w-px bg-white/20"></div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-dashboard-primary to-dashboard-accent bg-clip-text text-transparent">
                  Sending Volume Dashboard
                </h1>
                <p className="text-white/70 mt-1">Email Campaign Volume Analytics & Performance</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                <TrendingUp className="h-3 w-3 mr-1" />
                Volume Trending Up
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Volume Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Send className="h-6 w-6 text-dashboard-primary" />
                <Badge variant="outline" className="bg-dashboard-primary/20 text-dashboard-primary border-dashboard-primary/40">
                  Today
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">12,847</div>
              <p className="text-white/70 text-sm">Emails Sent Today</p>
              <p className="text-dashboard-success text-xs mt-1">+8.2% from yesterday</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="h-6 w-6 text-dashboard-accent" />
                <Badge variant="outline" className="bg-dashboard-accent/20 text-dashboard-accent border-dashboard-accent/40">
                  MTD
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">387K</div>
              <p className="text-white/70 text-sm">Month to Date</p>
              <p className="text-dashboard-success text-xs mt-1">+15.3% vs last month</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Target className="h-6 w-6 text-dashboard-warning" />
                <Badge variant="outline" className="bg-dashboard-warning/20 text-dashboard-warning border-dashboard-warning/40">
                  Goal
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">77.4%</div>
              <p className="text-white/70 text-sm">Monthly Target</p>
              <p className="text-dashboard-warning text-xs mt-1">112.6K remaining</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-6 w-6 text-dashboard-success" />
                <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                  Rate
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white mb-1">96.8%</div>
              <p className="text-white/70 text-sm">Delivery Rate</p>
              <p className="text-dashboard-success text-xs mt-1">+0.5% improvement</p>
            </CardContent>
          </Card>
        </div>

        {/* Volume Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Volume Chart */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-dashboard-primary" />
                Daily Volume Trends (Last 14 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {[8200, 9500, 11200, 10800, 12400, 11900, 13200, 12800, 14100, 13500, 15200, 14800, 12847, 11200].map((volume, index) => (
                  <div key={index} className="flex-1 bg-gradient-to-t from-dashboard-primary/40 to-dashboard-primary/80 rounded-t-sm relative group hover:from-dashboard-primary/60 hover:to-dashboard-primary transition-all">
                    <div 
                      className="w-full rounded-t-sm"
                      style={{ height: `${(volume / 15200) * 100}%` }}
                    ></div>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {volume.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-white/60 text-xs mt-2">
                <span>14d ago</span>
                <span>Today</span>
              </div>
            </CardContent>
          </Card>

          {/* Volume by Campaign Type */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-dashboard-accent" />
                Volume by Campaign Type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { type: "Lead Generation", volume: 5847, percentage: 45.5, color: "dashboard-primary" },
                { type: "Nurture Sequences", volume: 3921, percentage: 30.5, color: "dashboard-accent" },
                { type: "Follow-up Campaigns", volume: 2156, percentage: 16.8, color: "dashboard-success" },
                { type: "Re-engagement", volume: 923, percentage: 7.2, color: "dashboard-warning" }
              ].map((campaign, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{campaign.type}</span>
                    <span className="text-white/70">{campaign.volume.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r from-${campaign.color}/60 to-${campaign.color}`}
                      style={{ width: `${campaign.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-white/60 text-sm">{campaign.percentage}% of total volume</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Hourly Distribution */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-dashboard-success" />
                Peak Send Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { hour: "9:00 AM", volume: 2847, percentage: 22.1 },
                { hour: "2:00 PM", volume: 2156, percentage: 16.8 },
                { hour: "11:00 AM", volume: 1923, percentage: 15.0 },
                { hour: "4:00 PM", volume: 1654, percentage: 12.9 }
              ].map((hour, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{hour.hour}</p>
                    <p className="text-white/60 text-sm">{hour.volume.toLocaleString()} emails</p>
                  </div>
                  <div className="text-dashboard-success font-semibold">{hour.percentage}%</div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Account Distribution */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-dashboard-primary" />
                Top Sending Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { account: "sales@maverickmarketing.com", volume: 3247, status: "Active" },
                { account: "outreach@maverickmarketing.com", volume: 2891, status: "Active" },
                { account: "campaigns@maverickmarketing.com", volume: 2456, status: "Active" },
                { account: "follow-up@maverickmarketing.com", volume: 1923, status: "Active" }
              ].map((account, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{account.account}</p>
                    <p className="text-white/60 text-xs">{account.volume.toLocaleString()} sent today</p>
                  </div>
                  <Badge variant="outline" className="bg-dashboard-success/20 text-dashboard-success border-dashboard-success/40">
                    {account.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Volume Targets */}
          <Card className="bg-white/5 backdrop-blur-sm border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-dashboard-warning" />
                Monthly Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">Current Month</span>
                  <span className="text-dashboard-warning font-bold">77.4%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3">
                  <div className="h-3 rounded-full bg-gradient-to-r from-dashboard-warning/60 to-dashboard-warning" style={{ width: "77.4%" }}></div>
                </div>
                <p className="text-white/60 text-sm mt-1">387K / 500K target</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Daily Average Needed</span>
                  <span className="text-white font-semibold">18,753</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Days Remaining</span>
                  <span className="text-white font-semibold">6</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Projected Total</span>
                  <span className="text-dashboard-success font-semibold">489K</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SendingVolumeDashboard;