import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Fixtures from "@/pages/fixtures";
import MatchDetail from "@/pages/match-detail";
import Players from "@/pages/players";
import Leaderboard from "@/pages/leaderboard";
import Settings from "@/pages/settings";
import { BottomNav } from "@/components/bottom-nav";

function Router() {
  return (
    <div className="min-h-screen pb-20">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/fixtures" component={Fixtures} />
        <Route path="/match/:id" component={MatchDetail} />
        <Route path="/players" component={Players} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
