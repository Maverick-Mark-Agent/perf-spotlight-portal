import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const SendingVolumeDashboard = () => {
  const clientData = [
    { name: "Kim Wallace", emails: 76905, rank: 1 },
    { name: "Jason Binyon", emails: 65558, rank: 2 },
    { name: "David Amiri", emails: 45191, rank: 3 },
    { name: "Workspark", emails: 37985, rank: 4 },
    { name: "John Roberts", emails: 35306, rank: 5 },
    { name: "Rob Russell", emails: 31772, rank: 6 },
    { name: "StreetSmart Trucking", emails: 27104, rank: 7 },
    { name: "StreetSmart P&C", emails: 21638, rank: 8 },
    { name: "Danny Schwartz", emails: 20753, rank: 9 },
    { name: "Radiant Energy", emails: 17045, rank: 10 },
    { name: "SMA Insurance", emails: 16246, rank: 11 },
    { name: "StreetSmart Commercial", emails: 15860, rank: 12 },
    { name: "Jeff Schroder", emails: 14705, rank: 13 },
    { name: "Devin Hodo", emails: 13555, rank: 14 },
    { name: "Kirk Hodgson", emails: 11108, rank: 15 },
    { name: "ATI", emails: 6059, rank: 16 },
    { name: "Maverick Longrun", emails: 3611, rank: 17 }
  ];

  const getBarColor = (rank: number) => {
    if (rank <= 3) return "#10b981"; // Green for top 3
    if (rank >= 15) return "#ef4444"; // Red for bottom 3
    return "hsl(var(--dashboard-primary))"; // Default blue
  };

  const totalEmails = clientData.reduce((sum, client) => sum + client.emails, 0);

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
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-dashboard-primary to-dashboard-accent bg-clip-text text-transparent">
                  Client Email Performance
                </h1>
                <p className="text-white/70 mt-2 text-lg">MTD Email Volume by Client - {totalEmails.toLocaleString()} Total Emails Sent</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Performance Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Top Performers */}
          <Card className="bg-gradient-to-br from-green-500/20 to-green-600/30 backdrop-blur-sm border-green-400/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-green-100 flex items-center gap-2 text-xl">
                <TrendingUp className="h-6 w-6" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.slice(0, 3).map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-green-500/20 rounded-lg border border-green-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-400 text-green-900 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="text-green-100 font-semibold">{client.name}</span>
                  </div>
                  <span className="text-green-200 font-bold text-lg">{client.emails.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <BarChart3 className="h-6 w-6" />
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="text-5xl font-bold text-white mb-2">{totalEmails.toLocaleString()}</div>
              <p className="text-white/70 text-lg">Total MTD Emails</p>
              <p className="text-dashboard-accent text-sm mt-2">Across {clientData.length} Active Clients</p>
            </CardContent>
          </Card>

          {/* Bottom Performers */}
          <Card className="bg-gradient-to-br from-red-500/20 to-red-600/30 backdrop-blur-sm border-red-400/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-red-100 flex items-center gap-2 text-xl">
                <Target className="h-6 w-6" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.slice(-3).reverse().map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-red-500/20 rounded-lg border border-red-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-400 text-red-900 flex items-center justify-center font-bold text-sm">
                      {clientData.length - 2 + index}
                    </div>
                    <span className="text-red-100 font-semibold">{client.name}</span>
                  </div>
                  <span className="text-red-200 font-bold text-lg">{client.emails.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Chart */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-white flex items-center gap-3 text-2xl">
              <Users className="h-7 w-7 text-dashboard-primary" />
              MTD Emails Sent by Client
            </CardTitle>
            <p className="text-white/60 mt-2">Performance ranking from highest to lowest volume</p>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={clientData}
                  layout="horizontal"
                  margin={{ top: 20, right: 60, left: 140, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    type="number" 
                    stroke="rgba(255,255,255,0.8)"
                    fontSize={14}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.8)"
                    fontSize={14}
                    width={135}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.9)",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderRadius: "12px",
                      color: "white",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value.toLocaleString()} emails`, 
                      `Rank #${props.payload.rank} - MTD Volume`
                    ]}
                    labelStyle={{ color: "white", fontWeight: "bold" }}
                  />
                  <Bar dataKey="emails" radius={[0, 8, 8, 0]}>
                    {clientData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={getBarColor(entry.rank)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SendingVolumeDashboard;