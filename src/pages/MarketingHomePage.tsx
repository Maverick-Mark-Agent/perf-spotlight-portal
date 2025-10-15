import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Users,
  Mail,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

/**
 * Marketing Landing Page for Maverick Marketing
 *
 * This is the public-facing homepage that visitors see
 * when they go to your domain (maverickmarketing.com)
 */
const MarketingHomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header/Navigation */}
      <header className="border-b border-white/10 backdrop-blur-lg bg-white/5">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                Maverick Marketing
              </h1>
            </div>

            <Link to="/login">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                Client Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Transform Your Lead Generation
          </h2>
          <p className="text-xl text-purple-200 mb-8">
            Data-driven email marketing campaigns that deliver qualified leads
            directly to your pipeline. Track performance in real-time with our
            powerful client portal.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white">
                Access Your Portal
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="mailto:support@maverickmarketingllc.com">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-white text-center mb-12">
          Why Choose Maverick Marketing
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Qualified Leads
              </h4>
              <p className="text-white/70">
                Receive only high-quality, interested prospects that match your
                ideal customer profile.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Real-Time Analytics
              </h4>
              <p className="text-white/70">
                Track campaign performance, email metrics, and ROI through your
                personalized dashboard.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Mail className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Email Campaigns
              </h4>
              <p className="text-white/70">
                Professional, targeted email campaigns designed to generate responses
                and drive conversions.
              </p>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Pipeline Management
              </h4>
              <p className="text-white/70">
                Organize and track leads through your sales pipeline with our
                intuitive kanban board.
              </p>
            </CardContent>
          </Card>

          {/* Feature 5 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Secure & Private
              </h4>
              <p className="text-white/70">
                Your data is protected with enterprise-level security and
                role-based access controls.
              </p>
            </CardContent>
          </Card>

          {/* Feature 6 */}
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <h4 className="text-xl font-semibold text-white mb-2">
                Automated Workflows
              </h4>
              <p className="text-white/70">
                Set it and forget it. Our automated systems work 24/7 to generate
                and nurture leads.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-white text-center mb-12">
          How It Works
        </h3>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">
                  We Build Your Campaign
                </h4>
                <p className="text-white/70">
                  Our team creates targeted email campaigns based on your ideal
                  customer profile and business goals.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">
                  Leads Flow In
                </h4>
                <p className="text-white/70">
                  Interested prospects are automatically synced to your client portal
                  in real-time as they respond to campaigns.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <h4 className="text-xl font-semibold text-white mb-2">
                  You Close Deals
                </h4>
                <p className="text-white/70">
                  Manage your pipeline, track conversions, and measure ROI all from
                  your personalized dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-purple-600 to-pink-600 border-0">
          <CardContent className="p-12 text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Scale Your Lead Generation?
            </h3>
            <p className="text-xl text-white/90 mb-8">
              Join our growing list of successful clients
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                  Access Client Portal
                </Button>
              </Link>
              <a href="mailto:support@maverickmarketingllc.com">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20">
                  Contact Us
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/60 text-sm">
              © 2025 Maverick Marketing LLC. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="mailto:support@maverickmarketingllc.com" className="text-white/60 hover:text-white text-sm">
                Contact
              </a>
              <Link to="/login" className="text-white/60 hover:text-white text-sm">
                Client Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingHomePage;
