import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
} from "lucide-react";
import type {
  ComplaintRecord,
  ComplaintSeverity,
  ComplaintStatus,
} from "../types/complaint";

interface ComplaintQueueProps {
  complaints: ComplaintRecord[];
  isLoading: boolean;
  selectedTicketId: string | null;
  searchQuery: string;
  statusFilter: "All" | ComplaintStatus;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "All" | ComplaintStatus) => void;
  onSelectComplaint: (complaint: ComplaintRecord) => void;
  onFocusForm?: () => void;
}

function PriorityText({ severity }: { severity: ComplaintSeverity }) {
  if (severity === "Critical") {
    return <span className="font-semibold text-red-700">Critical</span>;
  }
  if (severity === "High") {
    return <span className="font-semibold text-amber-700">High</span>;
  }
  if (severity === "Medium") {
    return <span className="font-medium text-slate-800">Medium</span>;
  }
  return <span className="text-slate-600">Low</span>;
}

function StatusCell({ status }: { status: ComplaintStatus }) {
  if (status === "Resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Resolved</span>
      </span>
    );
  }
  if (status === "In Progress") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>In Progress</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Open</span>
    </span>
  );
}

const FILTER_OPTIONS: Array<"All" | ComplaintStatus> = [
  "All",
  "Open",
  "In Progress",
  "Resolved",
];

export function ComplaintQueue({
  complaints,
  isLoading,
  selectedTicketId,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onSelectComplaint,
  onFocusForm,
}: ComplaintQueueProps) {
  return (
    <section
      aria-labelledby="queue-heading"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="queue-heading" className="text-base font-semibold text-slate-900">
            Submitted Complaints Database
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            All persisted tickets stored in SQLite. Select any row to inspect the 3-agent result.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search ticket, location, dept..."
              aria-label="Search complaints"
              className="pl-9 pr-3 py-1.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 w-60"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by status"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onStatusFilterChange(option)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === option
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">
            No matching complaints in the database
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {searchQuery || statusFilter !== "All"
              ? "Try clearing your search or status filter."
              : "Submit your first campus complaint using the form to generate a ticket ID."}
          </p>
          {onFocusForm && !searchQuery && statusFilter === "All" && (
            <button
              type="button"
              onClick={onFocusForm}
              className="mt-4 inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Submit First Complaint
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">Ticket ID</th>
                <th className="py-3 px-4 whitespace-nowrap">Location</th>
                <th className="py-3 px-4 whitespace-nowrap">Category</th>
                <th className="py-3 px-4 whitespace-nowrap">Priority</th>
                <th className="py-3 px-4 whitespace-nowrap">Assigned Department</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Submitted</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {complaints.map((item) => {
                const isSelected = item.ticketId === selectedTicketId;
                const dateLabel = new Date(item.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <tr
                    key={item.ticketId}
                    tabIndex={0}
                    onClick={() => onSelectComplaint(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectComplaint(item);
                      }
                    }}
                    className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:bg-blue-50 ${
                      isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComplaint(item);
                        }}
                        className="font-mono text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline tabular-nums whitespace-nowrap"
                      >
                        {item.ticketId}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 max-w-[200px] truncate">
                      {item.location}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                      <PriorityText severity={item.priority} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-[200px] truncate">
                      {item.assignedDepartment}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <StatusCell status={item.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {dateLabel}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectComplaint(item);
                        }}
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline whitespace-nowrap"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
