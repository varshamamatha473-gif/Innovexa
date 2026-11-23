import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { ComplaintForm } from "./components/ComplaintForm";
import { ComplaintQueue } from "./components/ComplaintQueue";
import { ResultPanel } from "./components/ResultPanel";
import { TicketDetailModal } from "./components/TicketDetailModal";
import type {
  ComplaintRecord,
  ComplaintStatus,
  SubmitComplaintPayload,
} from "./types/complaint";

type ActiveView = "intake" | "database";

async function parseApiResponse<T>(response: Response): Promise<T & { error?: string }> {
  const rawText = await response.text();
  if (!rawText) {
    return {} as T & { error?: string };
  }
  try {
    return JSON.parse(rawText) as T & { error?: string };
  } catch {
    throw new Error(
      `Server returned HTTP ${response.status}: ${rawText.slice(0, 200)}`
    );
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>("intake");
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRecord | null>(null);
  const [detailComplaint, setDetailComplaint] = useState<ComplaintRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ComplaintStatus>("All");

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const resultSectionRef = useRef<HTMLDivElement | null>(null);

  const fetchComplaints = useCallback(async () => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const response = await fetch("/api/complaints");
      const data = await parseApiResponse<{ complaints?: ComplaintRecord[] }>(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to load saved complaints.");
      }
      const list = data.complaints ?? [];
      setComplaints(list);
      setSelectedComplaint((current) => {
        if (!current) return list[0] ?? null;
        return list.find((c) => c.ticketId === current.ticketId) ?? current;
      });
    } catch (err: unknown) {
      setQueueError(
        err instanceof Error ? err.message : "Could not load complaints from the database."
      );
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const handleSubmitComplaint = async (
    payload: SubmitComplaintPayload
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse<{ complaint?: ComplaintRecord }>(response);

      if (!response.ok || !data.complaint) {
        throw new Error(
          data.error ||
            `Failed to process complaint (HTTP ${response.status}). Please try again.`
        );
      }

      const saved = data.complaint;
      setComplaints((prev) => [
        saved,
        ...prev.filter((item) => item.ticketId !== saved.ticketId),
      ]);
      setSelectedComplaint(saved);
      setSearchQuery("");
      setStatusFilter("All");
      setSuccessMessage(
        `Complaint submitted! Ticket ${saved.ticketId} was processed by Complaint Analyzer, Investigation Agent, and Action Agent, and saved permanently to the database.`
      );

      requestAnimationFrame(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });

      return true;
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Unexpected error submitting complaint."
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (
    ticketId: string,
    nextStatus: ComplaintStatus
  ): Promise<void> => {
    setUpdatingTicketId(ticketId);
    try {
      const response = await fetch(`/api/complaints/${encodeURIComponent(ticketId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await parseApiResponse<{ complaint?: ComplaintRecord }>(response);

      if (!response.ok || !data.complaint) {
        throw new Error(data.error || "Failed to update ticket status.");
      }

      const updated = data.complaint;
      setComplaints((prev) =>
        prev.map((item) => (item.ticketId === updated.ticketId ? updated : item))
      );
      setSelectedComplaint((prev) =>
        prev?.ticketId === updated.ticketId ? updated : prev
      );
      setDetailComplaint((prev) =>
        prev?.ticketId === updated.ticketId ? updated : prev
      );
    } catch (err: unknown) {
      setQueueError(
        err instanceof Error ? err.message : "Failed to update ticket status."
      );
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const filteredComplaints = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return complaints.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        item.ticketId.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.assignedDepartment.toLowerCase().includes(query) ||
        item.complaintText.toLowerCase().includes(query) ||
        item.reporterName.toLowerCase().includes(query)
      );
    });
  }, [complaints, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    for (const c of complaints) {
      if (c.status === "Open") open++;
      else if (c.status === "In Progress") inProgress++;
      else if (c.status === "Resolved") resolved++;
    }
    return { total: complaints.length, open, inProgress, resolved };
  }, [complaints]);

  const handleFocusForm = () => {
    setActiveView("intake");
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleSelectFromQueue = useCallback(async (complaint: ComplaintRecord) => {
    setSelectedComplaint(complaint);
    setDetailComplaint(complaint);
    setDetailError(null);
    setIsLoadingDetail(true);

    try {
      const response = await fetch(
        `/api/complaints/${encodeURIComponent(complaint.ticketId)}`
      );
      const data = await parseApiResponse<{ complaint?: ComplaintRecord }>(response);
      if (!response.ok || !data.complaint) {
        throw new Error(data.error || `Failed to load ticket ${complaint.ticketId}.`);
      }
      const freshRecord = data.complaint;
      setSelectedComplaint(freshRecord);
      setDetailComplaint((current) =>
        current?.ticketId === freshRecord.ticketId ? freshRecord : current
      );
      setComplaints((prev) =>
        prev.map((item) =>
          item.ticketId === freshRecord.ticketId ? freshRecord : item
        )
      );
    } catch (err: unknown) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "Could not refresh the latest database record."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col bg-white border-r border-slate-200">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            CampusConnect
          </span>
        </div>

        <nav aria-label="Workspace navigation" className="p-4 space-y-1 flex-1">
          <button
            type="button"
            onClick={() => setActiveView("intake")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeView === "intake"
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Inbox className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Submit &amp; Triage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("database")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeView === "database"
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ticket Database</span>
          </button>
        </nav>

        <div className="p-5 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 mb-3">Database Summary</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Total Tickets</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {counts.total}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Open</dt>
              <dd className="font-mono font-medium text-blue-700 tabular-nums">
                {counts.open}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">In Progress</dt>
              <dd className="font-mono font-medium text-amber-700 tabular-nums">
                {counts.inProgress}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Resolved</dt>
              <dd className="font-mono font-medium text-emerald-700 tabular-nums">
                {counts.resolved}
              </dd>
            </div>
          </dl>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="lg:hidden font-display text-base font-bold text-slate-900 whitespace-nowrap shrink-0">
              CampusConnect
            </span>
            <span className="lg:hidden text-slate-300" aria-hidden="true">
              /
            </span>
            <h1 className="text-sm font-medium text-slate-700 truncate">
              {activeView === "intake"
                ? "CampusConnect / Complaint Intake & Three-Agent Triage"
                : "CampusConnect / Ticket Database"}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={activeView === "database" ? handleFocusForm : () => void fetchComplaints()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {activeView === "database" ? (
                <span>New Complaint</span>
              ) : (
                <>
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingQueue ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span>Refresh Queue</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Mobile/Tablet View Switcher */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView("intake")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeView === "intake"
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Submit &amp; Triage
          </button>
          <button
            type="button"
            onClick={() => setActiveView("database")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeView === "database"
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Ticket Database ({counts.total})
          </button>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto space-y-6">
          {successMessage && (
            <div
              role="status"
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          {queueError && (
            <div
              role="alert"
              className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {queueError}
            </div>
          )}

          {activeView === "intake" ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5">
                  <ComplaintForm
                    isSubmitting={isSubmitting}
                    serverError={submitError}
                    onClearError={() => setSubmitError(null)}
                    onSubmit={handleSubmitComplaint}
                    inputRef={nameInputRef}
                  />
                </div>
                <div ref={resultSectionRef} className="lg:col-span-7 space-y-4">
                  <ResultPanel
                    complaint={selectedComplaint}
                    isSubmitting={isSubmitting}
                    onStatusChange={handleStatusChange}
                    updatingTicketId={updatingTicketId}
                  />
                </div>
              </div>

              <ComplaintQueue
                complaints={filteredComplaints}
                isLoading={isLoadingQueue}
                selectedTicketId={selectedComplaint?.ticketId ?? null}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onSearchChange={setSearchQuery}
                onStatusFilterChange={setStatusFilter}
                onSelectComplaint={handleSelectFromQueue}
                onFocusForm={handleFocusForm}
              />
            </>
          ) : (
            <ComplaintQueue
              complaints={filteredComplaints}
              isLoading={isLoadingQueue}
              selectedTicketId={selectedComplaint?.ticketId ?? null}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onSearchChange={setSearchQuery}
              onStatusFilterChange={setStatusFilter}
              onSelectComplaint={handleSelectFromQueue}
              onFocusForm={handleFocusForm}
            />
          )}
        </main>
      </div>

      <TicketDetailModal
        complaint={detailComplaint}
        isLoading={isLoadingDetail}
        error={detailError}
        updatingTicketId={updatingTicketId}
        onClose={() => {
          setDetailComplaint(null);
          setDetailError(null);
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
