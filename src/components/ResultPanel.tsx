import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { ComplaintRecord, ComplaintStatus } from "../types/complaint";

interface ResultPanelProps {
  complaint: ComplaintRecord | null;
  isSubmitting: boolean;
  onStatusChange: (ticketId: string, nextStatus: ComplaintStatus) => Promise<void>;
  updatingTicketId: string | null;
}

const PIPELINE_STEPS = [
  {
    number: "01",
    title: "Complaint Analyzer",
    description: "Extracting summary, campus category, priority level, sentiment, and key entities.",
  },
  {
    number: "02",
    title: "Investigation Agent",
    description: "Investigating root cause, assigning responsible department, SLA window, and policy notes.",
  },
  {
    number: "03",
    title: "Action Agent",
    description: "Generating recommended remediation action, official reporter response, and closure checklist.",
  },
];

function StatusDisplay({ status }: { status: ComplaintStatus }) {
  if (status === "Resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        <span>Resolved</span>
      </span>
    );
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="w-4 h-4" aria-hidden="true" />
        <span>In Progress</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
      <span>Open</span>
    </span>
  );
}

export function ResultPanel({
  complaint,
  isSubmitting,
  onStatusChange,
  updatingTicketId,
}: ResultPanelProps) {
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const handleCopyTicket = async (ticketId: string) => {
    try {
      await navigator.clipboard.writeText(ticketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 1800);
    } catch {
      // Ignore clipboard failure if blocked
    }
  };

  const handleCopyResponse = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 1800);
    } catch {
      // Ignore clipboard failure if blocked
    }
  };

  if (isSubmitting) {
    return (
      <section
        aria-live="polite"
        aria-busy="true"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Three-Agent AI Triage in Progress
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Running Complaint Analyzer, Investigation Agent, and Action Agent, generating a
              unique ticket ID, and saving permanently to the database.
            </p>
          </div>
          <Loader2 className="w-5 h-5 text-blue-700 animate-spin shrink-0" aria-hidden="true" />
        </div>

        <div className="mt-5 divide-y divide-slate-200">
          {PIPELINE_STEPS.map((step) => (
            <div key={step.number} className="py-4 first:pt-1 last:pb-1 flex items-start gap-3">
              <span className="font-mono text-xs font-semibold text-blue-700 mt-0.5 tabular-nums">
                {step.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{step.description}</p>
              </div>
              <Loader2
                className="w-4 h-4 text-slate-400 animate-spin shrink-0 mt-0.5"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!complaint) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="pb-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Final Result &amp; Agent Triage Output
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Submit a complaint on the left—or select an existing ticket from the database queue—to
            view the ticket ID, priority, assigned department, investigation result, and
            recommended action.
          </p>
        </div>

        <div className="mt-5 divide-y divide-slate-200">
          {PIPELINE_STEPS.map((step) => (
            <div key={step.number} className="py-4 first:pt-1 last:pb-1 flex items-start gap-3">
              <span className="font-mono text-xs font-semibold text-slate-400 mt-0.5 tabular-nums">
                {step.number}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const formattedDate = new Date(complaint.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section
      aria-labelledby="result-ticket-heading"
      aria-live="polite"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      {/* Ticket Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="result-ticket-heading"
              className="font-mono text-xl font-semibold text-slate-900 tracking-tight tabular-nums"
            >
              {complaint.ticketId}
            </h2>
            <button
              type="button"
              onClick={() => handleCopyTicket(complaint.ticketId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              {copiedTicket ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
            <StatusDisplay status={complaint.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="font-medium text-slate-800">{complaint.category}</span>
            <span aria-hidden="true">·</span>
            <span>Priority: {complaint.priority}</span>
            <span aria-hidden="true">·</span>
            <span>{complaint.assignedDepartment}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Target SLA: {complaint.slaWindow}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              Saved to Database
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="ticket-status-select" className="text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="ticket-status-select"
            value={complaint.status}
            disabled={updatingTicketId === complaint.ticketId}
            onChange={(e) =>
              onStatusChange(complaint.ticketId, e.target.value as ComplaintStatus)
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
          >
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Key Decision Summary */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200 text-sm">
        <div>
          <span className="block text-xs text-slate-500">Ticket ID</span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {complaint.ticketId}
          </span>
        </div>
        <div>
          <span className="block text-xs text-slate-500">Priority</span>
          <span className="font-semibold text-slate-900">{complaint.priority}</span>
        </div>
        <div>
          <span className="block text-xs text-slate-500">Assigned Department</span>
          <span className="font-semibold text-slate-900">{complaint.assignedDepartment}</span>
        </div>
      </div>

      {/* Submitted Complaint Context */}
      <div className="mt-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">{complaint.reporterName}</span>
          <span aria-hidden="true">·</span>
          <span>{complaint.reporterEmail}</span>
          <span aria-hidden="true">·</span>
          <span className="font-medium text-slate-800">{complaint.location}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formattedDate}</span>
        </div>
        <p className="mt-2 text-sm text-slate-800 leading-relaxed">{complaint.complaintText}</p>
      </div>

      {/* Agent 1: Complaint Analyzer */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900">01. Complaint Analyzer</h3>
          <span className="text-xs text-slate-500">
            Sentiment: <strong className="font-medium text-slate-700">{complaint.agent1.sentiment}</strong>
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed">{complaint.agent1.summary}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">Affected Area: </span>
            <span className="font-medium text-slate-900">{complaint.agent1.affectedArea}</span>
          </div>
          <div>
            <span className="text-slate-500">Key Entities: </span>
            <span className="font-medium text-slate-900">
              {complaint.agent1.keyEntities.length > 0
                ? complaint.agent1.keyEntities.join(", ")
                : "None extracted"}
            </span>
          </div>
        </div>
      </div>

      {/* Agent 2: Investigation Agent */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">02. Investigation Agent</h3>
          {complaint.agent2.escalationRequired ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              Immediate Escalation Required
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">Standard Triage Protocol</span>
          )}
        </div>

        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          <span className="font-medium text-slate-900">Investigation Result: </span>
          {complaint.agent2.investigationResult}
        </p>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="block text-slate-500">Assigned Department</span>
            <span className="font-medium text-slate-900">
              {complaint.agent2.assignedDepartment}
            </span>
          </div>
          <div>
            <span className="block text-slate-500">Secondary Team</span>
            <span className="font-medium text-slate-900">{complaint.agent2.secondaryTeam}</span>
          </div>
          <div>
            <span className="block text-slate-500">Target SLA</span>
            <span className="font-medium text-slate-900 tabular-nums">
              {complaint.agent2.slaWindow}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-700 leading-relaxed">
          <span className="font-medium text-slate-900">Policy Guidance: </span>
          {complaint.agent2.policyNotes}
        </p>

        {complaint.agent2.staffActionSteps.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-700">Diagnostic Steps</p>
            <ol className="mt-1.5 space-y-1 list-decimal list-inside text-sm text-slate-700">
              {complaint.agent2.staffActionSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Agent 3: Action Agent */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">03. Action Agent</h3>
          <button
            type="button"
            onClick={() => handleCopyResponse(complaint.agent3.officialResponse)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            {copiedResponse ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Response Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy Response</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
          <span className="font-medium text-slate-900">Recommended Action: </span>
          {complaint.agent3.recommendedAction}
        </p>

        <div className="mt-3 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed">
          {complaint.agent3.officialResponse}
        </div>

        <p className="mt-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Expected Timeline: </span>
          {complaint.agent3.expectedTimeline}
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-700">Next Steps for Reporter</p>
            <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-slate-700">
              {complaint.agent3.reporterNextSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700">Closure Verification Checklist</p>
            <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-slate-700">
              {complaint.agent3.resolutionChecklist.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
