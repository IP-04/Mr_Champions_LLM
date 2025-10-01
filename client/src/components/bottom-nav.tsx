import { useLocation } from "wouter";

export function BottomNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", icon: "fa-home", label: "Fixtures" },
    { path: "/players", icon: "fa-user-friends", label: "Players" },
    { path: "/leaderboard", icon: "fa-trophy", label: "Leaderboard" },
    { path: "/settings", icon: "fa-cog", label: "Settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="grid grid-cols-4 gap-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                location === item.path
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <i className={`fas ${item.icon} text-xl`}></i>
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
