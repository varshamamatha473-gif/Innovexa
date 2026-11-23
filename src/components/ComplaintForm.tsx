import React, { useState } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import type { SubmitComplaintPayload } from "../types/complaint";

interface ComplaintFormProps {
  isSubmitting: boolean;
  serverError: string | null;
  onSubmit: (payload: SubmitComplaintPayload) => Promise<boolean>;
  onClearError?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const SAMPLE_COMPLAINTS: Array<{ label: string; payload: SubmitComplaintPayload }> = [
  {
    label: "HVAC outage",
    payload: {
      reporterName: "Maya Lin",
      reporterEmail: "maya.lin@campus.edu",
      location: "North Residence Hall, 3rd Floor",
      complaintText:
        "The heating system on the 3rd floor of North Residence Hall stopped working overnight. Hallways and student rooms are freezing and condensation is forming near the stairwell windows.",
    },
  },
  {
    label: "Library Wi-Fi drop",
    payload: {
      reporterName: "Devon Patel",
      reporterEmail: "devon.patel@campus.edu",
      location: "Science & Engineering Library, Quiet Wing",
      complaintText:
        "Campus Wi-Fi has been disconnecting every five minutes on the 2nd floor quiet study wing since 8:30 AM, preventing students from accessing exam portals and submitting lab reports.",
    },
  },
  {
    label: "Crosswalk lighting",
    payload: {
      reporterName: "Elena Torres",
      reporterEmail: "elena.torres@campus.edu",
      location: "West Gate Pedestrian Crosswalk",
      complaintText:
        "Three overhead streetlights at the West Gate pedestrian crosswalk are completely dark after 6 PM, creating a visibility hazard for students walking back from evening labs.",
    },
  },
];

export function ComplaintForm({
  isSubmitting,
  serverError,
  onSubmit,
  onClearError,
  inputRef,
}: ComplaintFormProps) {
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [location, setLocation] = useState("");
  const [complaintText, setComplaintText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleApplySample = (sample: SubmitComplaintPayload) => {
    setReporterName(sample.reporterName);
    setReporterEmail(sample.reporterEmail);
    setLocation(sample.location);
    setComplaintText(sample.complaintText);
    setValidationError(null);
    onClearError?.();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSubmitting) {
      return;
    }

    const trimmedName = reporterName.trim();
    const trimmedEmail = reporterEmail.trim();
    const trimmedLocation = location.trim();
    const trimmedComplaint = complaintText.trim();

    if (!trimmedName) {
      setValidationError("Reporter Name is required.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setValidationError("A valid Campus Email address is required.");
      return;
    }
    if (!trimmedLocation) {
      setValidationError("Building or Campus Location is required.");
      return;
    }
    if (!trimmedComplaint) {
      setValidationError("Complaint Details are required.");
      return;
    }
    if (trimmedComplaint.length < 10) {
      setValidationError(
        "Complaint Details must be at least 10 characters so the AI agents can analyze it."
      );
      return;
    }

    setValidationError(null);
    onClearError?.();

    const succeeded = await onSubmit({
      reporterName: trimmedName,
      reporterEmail: trimmedEmail,
      location: trimmedLocation,
      complaintText: trimmedComplaint,
    });

    // Only clear the form after the server confirms persistence and returns the ticket result
    if (succeeded) {
      setReporterName("");
      setReporterEmail("");
      setLocation("");
      setComplaintText("");
    }
  };

  const activeError = validationError || serverError;

  return (
    <section
      aria-labelledby="complaint-form-heading"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <h2 id="complaint-form-heading" className="text-lg font-semibold text-slate-900">
            Submit a Campus Complaint
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Triaged automatically by three AI agents and logged with a unique ticket ID.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Quick fill:</span>
        {SAMPLE_COMPLAINTS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            disabled={isSubmitting}
            onClick={() => handleApplySample(sample.payload)}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        {activeError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{activeError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="reporter-name"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Reporter Name <span className="text-red-600">*</span>
            </label>
            <input
              ref={inputRef}
              id="reporter-name"
              name="reporterName"
              type="text"
              value={reporterName}
              onChange={(e) => {
                setReporterName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isSubmitting}
              placeholder="e.g., Maya Lin"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:bg-slate-50"
              required
            />
          </div>

          <div>
            <label
              htmlFor="reporter-email"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Campus Email <span className="text-red-600">*</span>
            </label>
            <input
              id="reporter-email"
              name="reporterEmail"
              type="email"
              value={reporterEmail}
              onChange={(e) => {
                setReporterEmail(e.target.value);
                if (validationError) setValidationError(null);
              }}
              disabled={isSubmitting}
              placeholder="e.g., maya.lin@campus.edu"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:bg-slate-50"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="campus-location"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Building or Campus Location <span className="text-red-600">*</span>
          </label>
          <input
            id="campus-location"
            name="location"
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isSubmitting}
            placeholder="e.g., Science Library 2nd Floor, North Hall Room 304"
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:bg-slate-50"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="complaint-details"
              className="block text-sm font-medium text-slate-700"
            >
              Complaint Details <span className="text-red-600">*</span>
            </label>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {complaintText.trim().length} chars
            </span>
          </div>
          <textarea
            id="complaint-details"
            name="complaintText"
            rows={5}
            value={complaintText}
            onChange={(e) => {
              setComplaintText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isSubmitting}
            placeholder="Describe what happened, when it started, and any safety or academic impact..."
            className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 disabled:bg-slate-50 resize-y"
            required
          />
        </div>

        <div className="pt-2 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Submits without reloading the page and saves permanently to the database.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Processing Agents...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Submit Complaint</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
