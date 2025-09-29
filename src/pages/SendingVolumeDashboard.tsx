import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target } from "lucide-react";
import { Link } from "react-router-dom";

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

        {/* Main Performance Display */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-white flex items-center gap-3 text-2xl">
              <Users className="h-7 w-7 text-dashboard-primary" />
              MTD Email Performance Rankings
            </CardTitle>
            <p className="text-white/60 mt-2">All clients ranked by email volume sent this month</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {clientData.map((client) => {
                const percentage = (client.emails / Math.max(...clientData.map(c => c.emails))) * 100;
                const isTopPerformer = client.rank <= 3;
                const isBottomPerformer = client.rank >= 15;
                
                return (
                  <div 
                    key={client.name} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                      isTopPerformer 
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/30 border-green-400/50 shadow-green-500/20' 
                        : isBottomPerformer 
                        ? 'bg-gradient-to-r from-red-500/20 to-red-600/30 border-red-400/50 shadow-red-500/20'
                        : 'bg-white/10 border-white/20'
                    } shadow-xl`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          isTopPerformer 
                            ? 'bg-green-400 text-green-900' 
                            : isBottomPerformer 
                            ? 'bg-red-400 text-red-900'
                            : 'bg-dashboard-primary text-white'
                        }`}>
                          #{client.rank}
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold ${
                            isTopPerformer ? 'text-green-100' : isBottomPerformer ? 'text-red-100' : 'text-white'
                          }`}>
                            {client.name}
                          </h3>
                          <p className={`text-sm ${
                            isTopPerformer ? 'text-green-200' : isBottomPerformer ? 'text-red-200' : 'text-white/70'
                          }`}>
                            {isTopPerformer ? 'Top Performer' : isBottomPerformer ? 'Needs Attention' : 'Standard Performance'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          isTopPerformer ? 'text-green-100' : isBottomPerformer ? 'text-red-100' : 'text-white'
                        }`}>
                          {client.emails.toLocaleString()}
                        </div>
                        <p className={`text-sm ${
                          isTopPerformer ? 'text-green-200' : isBottomPerformer ? 'text-red-200' : 'text-white/70'
                        }`}>
                          emails sent
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative">
                      <div className={`w-full h-4 rounded-full ${
                        isTopPerformer ? 'bg-green-900/30' : isBottomPerformer ? 'bg-red-900/30' : 'bg-white/10'
                      }`}>
                        <div 
                          className={`h-4 rounded-full transition-all duration-1000 ${
                            isTopPerformer 
                              ? 'bg-gradient-to-r from-green-400 to-green-500' 
                              : isBottomPerformer 
                              ? 'bg-gradient-to-r from-red-400 to-red-500'
                              : 'bg-gradient-to-r from-dashboard-primary to-dashboard-accent'
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className={`absolute right-2 top-0 h-4 flex items-center text-xs font-bold ${
                        isTopPerformer ? 'text-green-900' : isBottomPerformer ? 'text-red-900' : 'text-white'
                      }`}>
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SendingVolumeDashboard;