import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ComplaintRecord, ComplaintStatus } from "../types/complaint";

interface TicketDetailModalProps {
  complaint: ComplaintRecord | null;
  isLoading: boolean;
  error: string | null;
  updatingTicketId: string | null;
  onClose: () => void;
  onStatusChange: (ticketId: string, nextStatus: ComplaintStatus) => Promise<void>;
}

function StatusBadge({ status }: { status: ComplaintStatus }) {
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

export function TicketDetailModal({
  complaint,
  isLoading,
  error,
  updatingTicketId,
  onClose,
  onStatusChange,
}: TicketDetailModalProps) {
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [statusSavedMsg, setStatusSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setStatusSavedMsg(null);
  }, [complaint?.ticketId]);

  useEffect(() => {
    if (!complaint) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [complaint, onClose]);

  if (!complaint) {
    return null;
  }

  const handleCopyTicket = async () => {
    try {
      await navigator.clipboard.writeText(complaint.ticketId);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCopyResponse = async () => {
    try {
      await navigator.clipboard.writeText(complaint.agent3.officialResponse);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleAdminStatusUpdate = async (nextStatus: ComplaintStatus) => {
    setStatusSavedMsg(null);
    await onStatusChange(complaint.ticketId, nextStatus);
    setStatusSavedMsg(`Status updated to ${nextStatus} in database.`);
  };

  const submittedAt = new Date(complaint.createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updatedAt = new Date(complaint.updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-white shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="ticket-detail-modal-title"
                className="font-mono text-xl font-semibold text-slate-900 tabular-nums"
              >
                {complaint.ticketId}
              </h2>
              <button
                type="button"
                onClick={() => void handleCopyTicket()}
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
              <StatusBadge status={complaint.status} />
              {isLoading && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Syncing record...</span>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <Database className="w-3.5 h-3.5" aria-hidden="true" />
                Database Record #{complaint.id}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Submitted {submittedAt}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Last updated {updatedAt}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close ticket details"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {statusSavedMsg && (
            <div
              role="status"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{statusSavedMsg}</span>
            </div>
          )}

          {/* Key Metadata Grid & Admin Status Control */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-5 border-b border-slate-200 text-sm">
            <div>
              <span className="block text-xs text-slate-500">Ticket ID</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {complaint.ticketId}
              </span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Category</span>
              <span className="font-semibold text-slate-900">{complaint.category}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Location</span>
              <span className="font-semibold text-slate-900">{complaint.location}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Priority</span>
              <span className="font-semibold text-slate-900">{complaint.priority}</span>
            </div>
            <div>
              <span className="block text-xs text-slate-500">Assigned Department</span>
              <span className="font-semibold text-slate-900">{complaint.assignedDepartment}</span>
            </div>
            <div>
              <label
                htmlFor="modal-admin-status-select"
                className="block text-xs text-slate-500 mb-1"
              >
                Current Status (Admin Update)
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="modal-admin-status-select"
                  value={complaint.status}
                  disabled={updatingTicketId === complaint.ticketId}
                  onChange={(e) =>
                    void handleAdminStatusUpdate(e.target.value as ComplaintStatus)
                  }
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                {updatingTicketId === complaint.ticketId && (
                  <Loader2
                    className="w-4 h-4 text-blue-700 animate-spin shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Complete Complaint Description */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Complete Complaint Description
            </h3>
            <div className="mt-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{complaint.reporterName}</span>
                <span aria-hidden="true">·</span>
                <span>{complaint.reporterEmail}</span>
                <span aria-hidden="true">·</span>
                <span>{complaint.location}</span>
              </div>
              <p className="mt-2.5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {complaint.complaintText}
              </p>
            </div>
          </div>

          {/* Agent 1: Complaint Analyzer */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-sm font-semibold text-slate-900">01. Complaint Analyzer</h3>
              <span className="text-xs text-slate-500">
                Sentiment:{" "}
                <strong className="font-medium text-slate-700">
                  {complaint.agent1.sentiment}
                </strong>
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              {complaint.agent1.summary}
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Affected Area: </span>
                <span className="font-medium text-slate-900">
                  {complaint.agent1.affectedArea}
                </span>
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
          <div className="pt-5 border-t border-slate-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">02. Investigation Agent</h3>
              {complaint.agent2.escalationRequired ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  Immediate Escalation Required
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  Standard Triage Protocol
                </span>
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
                <span className="font-medium text-slate-900">
                  {complaint.agent2.secondaryTeam}
                </span>
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
                <p className="text-xs font-semibold text-slate-700">
                  Investigation &amp; Diagnostic Steps
                </p>
                <ol className="mt-1.5 space-y-1 list-decimal list-inside text-sm text-slate-700">
                  {complaint.agent2.staffActionSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Agent 3: Action Agent */}
          <div className="pt-5 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">03. Action Agent</h3>
              <button
                type="button"
                onClick={() => void handleCopyResponse()}
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
              <span className="font-medium text-slate-900">Recommended Solution: </span>
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
                <p className="text-xs font-semibold text-slate-700">Recommended Next Steps</p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-slate-700">
                  {complaint.agent3.reporterNextSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Closure Verification Checklist
                </p>
                <ul className="mt-1.5 space-y-1 list-disc list-inside text-sm text-slate-700">
                  {complaint.agent3.resolutionChecklist.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
