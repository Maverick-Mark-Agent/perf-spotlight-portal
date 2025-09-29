import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Mail, Users, BarChart3, Calendar, Send, Target } from "lucide-react";
import { Link } from "react-router-dom";

const SendingVolumeDashboard = () => {
  const clientData = [
    { name: "Kim Wallace", emails: 76905, target: 78000 },
    { name: "Jason Binyon", emails: 65558, target: 78000 },
    { name: "David Amiri", emails: 45191, target: 39000 },
    { name: "Workspark", emails: 37985, target: 52000 },
    { name: "John Roberts", emails: 35306, target: 39000 },
    { name: "Rob Russell", emails: 31772, target: 39000 },
    { name: "StreetSmart Trucking", emails: 27104, target: 52000 },
    { name: "StreetSmart P&C", emails: 21638, target: 39000 },
    { name: "Danny Schwartz", emails: 20753, target: 39000 },
    { name: "Radiant Energy", emails: 17045, target: 39000 },
    { name: "SMA Insurance", emails: 16246, target: 52000 },
    { name: "StreetSmart Commercial", emails: 15860, target: 52000 },
    { name: "Jeff Schroder", emails: 14705, target: 26000 },
    { name: "Devin Hodo", emails: 13555, target: 39000 },
    { name: "Kirk Hodgson", emails: 11108, target: 26000 },
    { name: "ATI", emails: 6059, target: 13000 },
    { name: "Maverick Longrun", emails: 3611, target: 26000 }
  ].map(client => ({
    ...client,
    targetPercentage: (client.emails / client.target) * 100,
    isAboveTarget: client.emails >= client.target,
    variance: client.emails - client.target
  })).sort((a, b) => b.targetPercentage - a.targetPercentage)
  .map((client, index) => ({
    ...client,
    rank: index + 1
  }));

  const getPerformanceColor = (client: any) => {
    if (client.isAboveTarget) return "green";
    if (client.targetPercentage >= 80) return "yellow";
    return "red";
  };

  const totalEmails = clientData.reduce((sum, client) => sum + client.emails, 0);
  const totalTargets = clientData.reduce((sum, client) => sum + client.target, 0);
  const overallTargetPercentage = (totalEmails / totalTargets) * 100;

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
                  Client Email Performance vs Targets
                </h1>
                <p className="text-white/70 mt-2 text-lg">
                  MTD: {totalEmails.toLocaleString()} / {totalTargets.toLocaleString()} 
                  ({overallTargetPercentage.toFixed(1)}% of target achieved)
                </p>
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
                Exceeding Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.filter(client => client.isAboveTarget).slice(0, 3).map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-green-500/20 rounded-lg border border-green-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-400 text-green-900 flex items-center justify-center font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <span className="text-green-100 font-semibold block">{client.name}</span>
                      <span className="text-green-200 text-sm">{client.targetPercentage.toFixed(1)}% of target</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-green-200 font-bold text-lg">{client.emails.toLocaleString()}</span>
                    <div className="text-green-300 text-xs">Target: {client.target.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <BarChart3 className="h-6 w-6" />
                Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <div className="text-5xl font-bold text-white mb-2">{overallTargetPercentage.toFixed(1)}%</div>
              <p className="text-white/70 text-lg">Target Achievement</p>
              <div className="mt-4 w-full bg-white/20 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    overallTargetPercentage >= 100 
                      ? 'bg-gradient-to-r from-green-400 to-green-500' 
                      : overallTargetPercentage >= 80
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${Math.min(overallTargetPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-dashboard-accent text-sm mt-2">{totalEmails.toLocaleString()} / {totalTargets.toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* Bottom Performers */}
          <Card className="bg-gradient-to-br from-red-500/20 to-red-600/30 backdrop-blur-sm border-red-400/30 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-red-100 flex items-center gap-2 text-xl">
                <Target className="h-6 w-6" />
                Below Target
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clientData.filter(client => !client.isAboveTarget).slice(-3).map((client, index) => (
                <div key={client.name} className="flex items-center justify-between p-4 bg-red-500/20 rounded-lg border border-red-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-400 text-red-900 flex items-center justify-center font-bold text-sm">
                      !
                    </div>
                    <div>
                      <span className="text-red-100 font-semibold block">{client.name}</span>
                      <span className="text-red-200 text-sm">{client.targetPercentage.toFixed(1)}% of target</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-red-200 font-bold text-lg">{client.emails.toLocaleString()}</span>
                    <div className="text-red-300 text-xs">Target: {client.target.toLocaleString()}</div>
                  </div>
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
              MTD Email Performance vs Targets
            </CardTitle>
            <p className="text-white/60 mt-2">All clients with actual vs target performance comparison</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {clientData.map((client) => {
                const percentage = (client.emails / client.target) * 100;
                const performanceColor = getPerformanceColor(client);
                const isExceeding = client.isAboveTarget;
                const isClose = client.targetPercentage >= 80 && client.targetPercentage < 100;
                const isFarBehind = client.targetPercentage < 50;
                
                return (
                  <div 
                    key={client.name} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                      isExceeding 
                        ? 'bg-gradient-to-r from-green-500/20 to-green-600/30 border-green-400/50 shadow-green-500/20' 
                        : isClose 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/30 border-yellow-400/50 shadow-yellow-500/20'
                        : isFarBehind
                        ? 'bg-gradient-to-r from-red-500/20 to-red-600/30 border-red-400/50 shadow-red-500/20'
                        : 'bg-gradient-to-r from-orange-500/20 to-orange-600/30 border-orange-400/50 shadow-orange-500/20'
                    } shadow-xl`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          isExceeding 
                            ? 'bg-green-400 text-green-900' 
                            : isClose
                            ? 'bg-yellow-400 text-yellow-900'
                            : isFarBehind
                            ? 'bg-red-400 text-red-900'
                            : 'bg-orange-400 text-orange-900'
                        }`}>
                          {isExceeding ? '✓' : client.targetPercentage.toFixed(0)}%
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold ${
                            isExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                          }`}>
                            {client.name}
                          </h3>
                          <p className={`text-sm ${
                            isExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                          }`}>
                            {isExceeding ? 'Target Exceeded!' : isClose ? 'Close to Target' : isFarBehind ? 'Far Behind Target' : 'Below Target'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          isExceeding ? 'text-green-100' : isClose ? 'text-yellow-100' : isFarBehind ? 'text-red-100' : 'text-orange-100'
                        }`}>
                          {client.emails.toLocaleString()}
                        </div>
                        <p className={`text-sm ${
                          isExceeding ? 'text-green-200' : isClose ? 'text-yellow-200' : isFarBehind ? 'text-red-200' : 'text-orange-200'
                        }`}>
                          Target: {client.target.toLocaleString()}
                        </p>
                        <p className={`text-xs font-semibold ${
                          isExceeding ? 'text-green-300' : isClose ? 'text-yellow-300' : isFarBehind ? 'text-red-300' : 'text-orange-300'
                        }`}>
                          {client.variance >= 0 ? '+' : ''}{client.variance.toLocaleString()} variance
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="relative">
                      <div className={`w-full h-4 rounded-full ${
                        isExceeding ? 'bg-green-900/30' : isClose ? 'bg-yellow-900/30' : isFarBehind ? 'bg-red-900/30' : 'bg-orange-900/30'
                      }`}>
                        <div 
                          className={`h-4 rounded-full transition-all duration-1000 ${
                            isExceeding 
                              ? 'bg-gradient-to-r from-green-400 to-green-500' 
                              : isClose
                              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                              : isFarBehind
                              ? 'bg-gradient-to-r from-red-400 to-red-500'
                              : 'bg-gradient-to-r from-orange-400 to-orange-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className={`absolute right-2 top-0 h-4 flex items-center text-xs font-bold ${
                        isExceeding ? 'text-green-900' : isClose ? 'text-yellow-900' : isFarBehind ? 'text-red-900' : 'text-orange-900'
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