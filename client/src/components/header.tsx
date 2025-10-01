import { useLocation } from "wouter";

export function Header() {
  const [location] = useLocation();
  
  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border backdrop-blur-sm bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <i className="fas fa-trophy text-background text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg font-bold">UCL Predictor</h1>
            <p className="text-xs text-muted-foreground">2025-26 Season</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            data-testid="button-notifications"
            className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-border transition-colors"
          >
            <i className="fas fa-bell text-foreground"></i>
          </button>
          <button 
            data-testid="button-profile"
            className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-border transition-colors"
          >
            <i className="fas fa-user-circle text-foreground"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
