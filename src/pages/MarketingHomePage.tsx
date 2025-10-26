import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  Users,
  Mail,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Target,
  Clock,
  Phone,
  MapPin,
  Star,
} from "lucide-react";

/**
 * Marketing Landing Page for Maverick Marketing LLC
 *
 * Professional landing page with Maverick branding, comprehensive content sections,
 * and clear calls-to-action for lead generation services.
 */
const MarketingHomePage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsAuthenticated(true);
      // Check if admin - simplified check
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile && (profile as any).role === 'admin') {
        setIsAdmin(true);
      }
    }
  };

  const getPortalLink = () => {
    if (isAuthenticated) {
      return isAdmin ? "/admin" : "/client-portal";
    }
    return "/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/images/maverick-logo-main.png"
                alt="Maverick Marketing LLC"
                className="h-12 w-auto"
              />
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Services
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Testimonials
              </a>
              <a href="#contact" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                Contact
              </a>
            </nav>

            <Link to="/login">
              <Button className="bg-[#5B8FF9] hover:bg-[#4A7FE8] text-white">
                Client Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#5B8FF9]/10 via-background to-background">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              Transform Your Lead Generation
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Data-driven email marketing campaigns that deliver qualified leads
              directly to your pipeline. Track performance in real-time with our
              powerful client portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={getPortalLink()}>
                <Button size="lg" className="bg-[#5B8FF9] hover:bg-[#4A7FE8] text-white text-lg px-8 py-6">
                  Access Your Portal
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#contact">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  Get Started
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#5B8FF9] mb-2">
                10,000+
              </div>
              <div className="text-sm text-muted-foreground">
                Leads Generated
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#5B8FF9] mb-2">
                50+
              </div>
              <div className="text-sm text-muted-foreground">
                Happy Clients
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#5B8FF9] mb-2">
                95%
              </div>
              <div className="text-sm text-muted-foreground">
                Client Retention
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#5B8FF9] mb-2">
                24/7
              </div>
              <div className="text-sm text-muted-foreground">
                Campaign Monitoring
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Why Choose Maverick Marketing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We combine cutting-edge technology with proven marketing strategies to deliver results
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <TrendingUp className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Qualified Leads Only
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Receive only high-quality, interested prospects that match your
                  ideal customer profile. No wasted time on unqualified contacts.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Real-Time Analytics
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Track campaign performance, email metrics, and ROI through your
                  personalized dashboard with live data updates.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <Mail className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Professional Campaigns
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Expertly crafted, targeted email campaigns designed to generate
                  responses and drive conversions at scale.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Pipeline Management
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Organize and track leads through your sales pipeline with our
                  intuitive kanban board and workflow tools.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <Shield className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Secure & Private
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Your data is protected with enterprise-level security and
                  role-based access controls. GDPR compliant.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300 hover:shadow-lg">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-[#5B8FF9]/10 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="h-7 w-7 text-[#5B8FF9]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Automated Workflows
                </h3>
                <p className="text-foreground/70 leading-relaxed">
                  Set it and forget it. Our automated systems work 24/7 to generate
                  and nurture leads while you focus on closing deals.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A simple, proven process to transform your lead generation
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300">
              <CardContent className="p-8 flex flex-col md:flex-row items-start gap-6">
                <div className="w-16 h-16 bg-[#5B8FF9] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                    We Build Your Campaign
                  </h3>
                  <p className="text-foreground/70 leading-relaxed text-lg">
                    Our team creates targeted email campaigns based on your ideal
                    customer profile and business goals. We handle everything from
                    copywriting to technical setup.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300">
              <CardContent className="p-8 flex flex-col md:flex-row items-start gap-6">
                <div className="w-16 h-16 bg-[#5B8FF9] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                    Leads Flow In
                  </h3>
                  <p className="text-foreground/70 leading-relaxed text-lg">
                    Interested prospects are automatically synced to your client portal
                    in real-time as they respond to campaigns. Get instant notifications
                    for hot leads.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-[#5B8FF9]/50 transition-all duration-300">
              <CardContent className="p-8 flex flex-col md:flex-row items-start gap-6">
                <div className="w-16 h-16 bg-[#5B8FF9] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-2xl">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                    You Close Deals
                  </h3>
                  <p className="text-foreground/70 leading-relaxed text-lg">
                    Manage your pipeline, track conversions, and measure ROI all from
                    your personalized dashboard. Focus on what you do best - closing deals.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              What Our Clients Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Trusted by businesses across industries
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-2">
              <CardContent className="p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#5B8FF9] text-[#5B8FF9]" />
                  ))}
                </div>
                <p className="text-foreground/80 leading-relaxed mb-6 italic">
                  "Maverick Marketing transformed our lead generation. We're now getting
                  3x more qualified leads per month, and the client portal makes tracking
                  everything so easy."
                </p>
                <div className="border-t pt-4">
                  <div className="font-semibold text-foreground">Sarah Johnson</div>
                  <div className="text-sm text-muted-foreground">CEO, TechStart Solutions</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#5B8FF9] text-[#5B8FF9]" />
                  ))}
                </div>
                <p className="text-foreground/80 leading-relaxed mb-6 italic">
                  "The ROI has been incredible. Within 60 days, we closed deals that
                  more than paid for the service. The team is professional and responsive."
                </p>
                <div className="border-t pt-4">
                  <div className="font-semibold text-foreground">Michael Chen</div>
                  <div className="text-sm text-muted-foreground">VP Sales, Growth Partners</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#5B8FF9] text-[#5B8FF9]" />
                  ))}
                </div>
                <p className="text-foreground/80 leading-relaxed mb-6 italic">
                  "Best investment we've made in our marketing stack. The quality of
                  leads is outstanding, and the analytics help us optimize our approach."
                </p>
                <div className="border-t pt-4">
                  <div className="font-semibold text-foreground">Emily Rodriguez</div>
                  <div className="text-sm text-muted-foreground">CMO, Enterprise Dynamics</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-[#5B8FF9] to-[#4A7FE8]">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Scale Your Lead Generation?
            </h2>
            <p className="text-xl text-white/90 mb-10 leading-relaxed">
              Join our growing list of successful clients and start receiving
              qualified leads today
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" className="bg-white text-[#5B8FF9] hover:bg-gray-100 text-lg px-8 py-6">
                  Access Client Portal
                </Button>
              </Link>
              <a href="#contact">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/20 text-lg px-8 py-6">
                  Schedule a Call
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Get In Touch
              </h2>
              <p className="text-xl text-muted-foreground">
                Ready to start generating more leads? Contact us today
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-2">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 bg-[#5B8FF9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-[#5B8FF9]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Email Us</h3>
                      <a href="mailto:office@maverickmarketingllc.com" className="text-[#5B8FF9] hover:underline">
                        office@maverickmarketingllc.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#5B8FF9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="h-6 w-6 text-[#5B8FF9]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Business Hours</h3>
                      <p className="text-foreground/70">Monday - Friday: 9AM - 6PM EST</p>
                      <p className="text-foreground/70">Weekend: Closed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 bg-gradient-to-br from-[#5B8FF9]/5 to-transparent">
                <CardContent className="p-8">
                  <h3 className="text-xl font-semibold text-foreground mb-4">
                    Already a Client?
                  </h3>
                  <p className="text-foreground/70 mb-6 leading-relaxed">
                    Access your personalized dashboard to view your leads, track
                    campaign performance, and manage your pipeline.
                  </p>
                  <Link to="/login">
                    <Button className="w-full bg-[#5B8FF9] hover:bg-[#4A7FE8] text-white">
                      Login to Client Portal
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <img
                src="/images/maverick-logo-main.png"
                alt="Maverick Marketing LLC"
                className="h-10 w-auto mb-4"
              />
              <p className="text-foreground/70 mb-4 max-w-md leading-relaxed">
                Data-driven email marketing campaigns that deliver qualified leads
                directly to your pipeline.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-foreground/70 hover:text-foreground transition-colors">
                    Services
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-foreground/70 hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-foreground/70 hover:text-foreground transition-colors">
                    Testimonials
                  </a>
                </li>
                <li>
                  <Link to="/login" className="text-foreground/70 hover:text-foreground transition-colors">
                    Client Login
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Contact</h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:office@maverickmarketingllc.com" className="text-foreground/70 hover:text-foreground transition-colors">
                    Email Us
                  </a>
                </li>
                <li className="text-foreground/70">
                  Mon-Fri: 9AM - 6PM EST
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-foreground/60 text-sm">
                © 2025 Maverick Marketing LLC. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a href="#" className="text-foreground/60 hover:text-foreground text-sm transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="text-foreground/60 hover:text-foreground text-sm transition-colors">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingHomePage;
