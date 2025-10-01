import { Header } from "@/components/header";

export default function Settings() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-xl font-bold mb-4">Settings</h3>

          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-semibold mb-4">About</h4>
              <p className="text-muted-foreground text-sm mb-2">
                UCL Performance Predictor uses advanced machine learning models to forecast match outcomes
                and player performances in the UEFA Champions League 2025-26 season.
              </p>
              <p className="text-muted-foreground text-sm">
                Our models analyze multi-horizon features, position-specific data, and real-time statistics
                to provide accurate predictions.
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-semibold mb-4">How Predictions Work</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Match predictions use team strength, recent form, and tactical analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Player forecasts incorporate position-specific metrics and historical data</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Models are updated daily with the latest squad and fixture information</span>
                </li>
              </ul>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-semibold mb-4">Model Details</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Accuracy</span>
                  <span className="text-sm font-semibold text-primary">94.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Predictions Made</span>
                  <span className="text-sm font-semibold">2,847</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm font-semibold">Today, 14:30 CET</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <h4 className="text-lg font-semibold mb-4">Contact & Support</h4>
              <p className="text-muted-foreground text-sm">
                For questions or feedback about the UCL Predictor platform, please contact our support team.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
