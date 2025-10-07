import { useState } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

type PhaseStatus = "pending" | "in_progress" | "completed";

interface Phase {
  number: number;
  title: string;
  milestone: string;
  effort: string;
  status: PhaseStatus;
  dependencies: number[];
}

const phases: Phase[] = [
  // Milestone 1: Foundation
  { number: 1, title: "Resolve Schema Conflicts & Run Migrations", milestone: "Foundation", effort: "2-3h", status: "pending", dependencies: [] },
  { number: 2, title: "Install Dependencies & Configure TypeScript", milestone: "Foundation", effort: "2-3h", status: "pending", dependencies: [1] },
  { number: 3, title: "Core Browser Automation Infrastructure", milestone: "Foundation", effort: "6-8h", status: "pending", dependencies: [2] },
  { number: 4, title: "Secrets Management & Environment Setup", milestone: "Foundation", effort: "3-4h", status: "pending", dependencies: [2] },
  { number: 5, title: "Error Handling & Logging Framework", milestone: "Foundation", effort: "4-5h", status: "pending", dependencies: [1, 2] },

  // Milestone 2: Data Pipeline
  { number: 6, title: "Cole X Dates Connector", milestone: "Data Pipeline", effort: "8-10h", status: "pending", dependencies: [3, 4, 5] },
  { number: 7, title: "Clay Connector", milestone: "Data Pipeline", effort: "6-8h", status: "pending", dependencies: [3, 4, 5] },
  { number: 8, title: "Email Bison Connector", milestone: "Data Pipeline", effort: "6-8h", status: "pending", dependencies: [3, 4, 5] },
  { number: 9, title: "Lead Pipeline (Validation, Normalization, Deduplication)", milestone: "Data Pipeline", effort: "6-8h", status: "pending", dependencies: [1, 5] },
  { number: 10, title: "Testing Framework & Fixtures", milestone: "Data Pipeline", effort: "4-5h", status: "pending", dependencies: [6, 7, 8, 9] },

  // Milestone 3: Workflow Automation
  { number: 11, title: "PT1 - Cole Monthly Pulls", milestone: "Workflow Automation", effort: "6-8h", status: "pending", dependencies: [6, 9] },
  { number: 12, title: "PT2 - Clay Formatting & Enrichment", milestone: "Workflow Automation", effort: "6-8h", status: "pending", dependencies: [7, 9, 11] },
  { number: 13, title: "PT3 - Totals Review & Gap Analysis", milestone: "Workflow Automation", effort: "5-6h", status: "pending", dependencies: [12] },
  { number: 14, title: "PT4 - Weekly Bison Uploads", milestone: "Workflow Automation", effort: "6-8h", status: "pending", dependencies: [8, 9, 12] },
  { number: 15, title: "PT5 - Evergreen Campaign Updates", milestone: "Workflow Automation", effort: "5-6h", status: "pending", dependencies: [8, 14] },

  // Milestone 4: Production Readiness
  { number: 16, title: "Orchestrator & Job Scheduling (BullMQ)", milestone: "Production Readiness", effort: "8-10h", status: "pending", dependencies: [11, 12, 13] },
  { number: 17, title: "GitHub Actions Workflows (Monthly & Weekly Cron)", milestone: "Production Readiness", effort: "4-5h", status: "pending", dependencies: [16] },
  { number: 18, title: "Observability (Logging, Traces, Screenshots)", milestone: "Production Readiness", effort: "5-6h", status: "pending", dependencies: [5, 16] },
  { number: 19, title: "Slack Notifications & Alerts", milestone: "Production Readiness", effort: "4-5h", status: "pending", dependencies: [5] },
  { number: 20, title: "Dashboard Enhancements & Documentation", milestone: "Production Readiness", effort: "6-8h", status: "pending", dependencies: [18, 19] },
];

const StatusIcon = ({ status }: { status: PhaseStatus }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "in_progress":
      return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
    case "pending":
      return <Circle className="w-5 h-5 text-gray-400" />;
    default:
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  }
};

export default function RolloutProgress() {
  const [selectedMilestone, setSelectedMilestone] = useState<string | "all">("all");

  const milestones = ["Foundation", "Data Pipeline", "Workflow Automation", "Production Readiness"];

  const filteredPhases = selectedMilestone === "all"
    ? phases
    : phases.filter(p => p.milestone === selectedMilestone);

  const completedCount = phases.filter(p => p.status === "completed").length;
  const inProgressCount = phases.filter(p => p.status === "in_progress").length;
  const pendingCount = phases.filter(p => p.status === "pending").length;
  const overallProgress = Math.round((completedCount / phases.length) * 100);

  const totalEffortMin = phases.reduce((sum, p) => {
    const [min] = p.effort.split("-").map(e => parseInt(e));
    return sum + min;
  }, 0);

  const totalEffortMax = phases.reduce((sum, p) => {
    const match = p.effort.match(/(\d+)h/g);
    if (!match) return sum;
    const max = parseInt(match[match.length - 1]);
    return sum + max;
  }, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Homeowner Agent Automation - Rollout Progress</h1>
          <p className="text-muted-foreground">
            Track implementation progress across 20 phases and 4 major milestones
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-sm font-medium text-muted-foreground">Overall Progress</div>
            <div className="text-3xl font-bold mt-2">{overallProgress}%</div>
            <div className="text-xs text-muted-foreground mt-1">{completedCount}/{phases.length} phases</div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm font-medium text-muted-foreground">Completed</div>
            <div className="text-3xl font-bold mt-2 text-green-500">{completedCount}</div>
            <div className="text-xs text-muted-foreground mt-1">phases done</div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm font-medium text-muted-foreground">In Progress</div>
            <div className="text-3xl font-bold mt-2 text-blue-500">{inProgressCount}</div>
            <div className="text-xs text-muted-foreground mt-1">currently active</div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="text-sm font-medium text-muted-foreground">Estimated Effort</div>
            <div className="text-3xl font-bold mt-2">{totalEffortMin}-{totalEffortMax}h</div>
            <div className="text-xs text-muted-foreground mt-1">total time</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Completion</span>
            <span className="text-sm text-muted-foreground">{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedMilestone("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedMilestone === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All Phases ({phases.length})
          </button>
          {milestones.map((milestone) => {
            const count = phases.filter(p => p.milestone === milestone).length;
            return (
              <button
                key={milestone}
                onClick={() => setSelectedMilestone(milestone)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedMilestone === milestone
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {milestone} ({count})
              </button>
            );
          })}
        </div>

        {/* Phases List */}
        <div className="space-y-3">
          {filteredPhases.map((phase) => (
            <div
              key={phase.number}
              className={`border rounded-lg p-4 transition-all ${
                phase.status === "completed"
                  ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                  : phase.status === "in_progress"
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                  : "bg-card"
              }`}
            >
              <div className="flex items-start gap-4">
                <StatusIcon status={phase.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-muted-foreground">
                          Phase {phase.number}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {phase.milestone}
                        </span>
                      </div>
                      <h3 className="font-medium text-base mb-2">{phase.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {phase.effort}
                        </span>
                        {phase.dependencies.length > 0 && (
                          <span className="text-xs">
                            Depends on: Phase {phase.dependencies.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        phase.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : phase.status === "in_progress"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {phase.status === "completed" ? "Completed" :
                         phase.status === "in_progress" ? "In Progress" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Documentation Link */}
        <div className="border rounded-lg p-6 bg-muted/50">
          <h3 className="font-semibold mb-2">📋 Master Plan Documentation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            View the complete rollout plan with detailed tasks, acceptance criteria, and dependency graphs.
          </p>
          <a
            href="/docs/rollout/00-rollout-master.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            View Master Plan Document →
          </a>
        </div>
      </div>
    </div>
  );
}
