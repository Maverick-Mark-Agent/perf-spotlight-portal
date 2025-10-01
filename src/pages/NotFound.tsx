import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center p-12 bg-card rounded-3xl border-2 border-border shadow-lg max-w-md">
        <div className="text-8xl font-bold text-primary mb-4">404</div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Page Not Found</h1>
        <p className="mb-6 text-foreground/60">Oops! The page you're looking for doesn't exist.</p>
        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-md hover:shadow-lg">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
