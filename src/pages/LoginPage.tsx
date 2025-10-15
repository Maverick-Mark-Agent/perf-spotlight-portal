import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

const LoginPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Welcome back!",
          description: "Successfully logged in",
        });

        // Redirect to client portal hub
        navigate("/client-portal");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions",
      });

      setResetMode(false);
    } catch (error: any) {
      console.error("Password reset error:", error);
      toast({
        title: "Reset failed",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/client-portal`,
        }
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Google login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Maverick Marketing
          </h1>
          <p className="text-purple-300">Client Portal Login</p>
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              {resetMode ? "Reset Password" : "Sign In"}
            </CardTitle>
            <CardDescription className="text-white/70">
              {resetMode
                ? "Enter your email to receive reset instructions"
                : "Access your lead pipeline and analytics"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={resetMode ? handlePasswordReset : handleLogin} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  />
                </div>
              </div>

              {/* Password Input (only in login mode) */}
              {!resetMode && (
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-white">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {resetMode ? "Sending..." : "Signing in..."}
                  </>
                ) : (
                  resetMode ? "Send Reset Email" : "Sign In"
                )}
              </Button>

              {/* Toggle Reset Mode */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setResetMode(!resetMode)}
                  className="text-sm text-purple-300 hover:text-purple-200 underline"
                >
                  {resetMode ? "Back to login" : "Forgot password?"}
                </button>
              </div>
            </form>

            {/* Divider */}
            {!resetMode && (
              <div className="mt-6 mb-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white/5 text-white/60">Or continue with</span>
                  </div>
                </div>
              </div>
            )}

            {/* Google Sign In Button */}
            {!resetMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border-white/20"
              >
                <FcGoogle className="w-5 h-5 mr-2" />
                Sign in with Google
              </Button>
            )}

            {/* Help Text */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-center text-sm text-white/60">
                Don't have an account?{" "}
                <a href="mailto:support@maverickmarketingllc.com" className="text-purple-300 hover:text-purple-200 underline">
                  Contact support
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-white/60 hover:text-white/80 underline"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
