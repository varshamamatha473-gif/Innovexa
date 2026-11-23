import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import Database from "better-sqlite3";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import type {
  Agent1Result,
  Agent2Result,
  Agent3Result,
  ComplaintRecord,
  ComplaintSeverity,
  ComplaintStatus,
} from "./src/types/complaint.ts";

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL = "gemini-4-hydrogen";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

// Avoid burning repeated round-trips on PRIMARY_MODEL once its daily free-tier quota is exhausted
let primaryDailyQuotaExhaustedUntil = 0;

function extractGeminiError(error: unknown): {
  status: number;
  message: string;
  isDailyQuota: boolean;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const isDailyQuota = raw.includes("GenerateRequestsPerDay");
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; status?: string; message?: string };
    };
    const code = parsed?.error?.code ?? 500;
    const msg = parsed?.error?.message ?? raw;
    if (code === 429 || parsed?.error?.status === "RESOURCE_EXHAUSTED") {
      return {
        status: 429,
        isDailyQuota,
        message:
          "Gemini API quota exceeded (429 RESOURCE_EXHAUSTED). Please verify or upgrade your API key in Settings > Secrets, or retry shortly.",
      };
    }
    if (code === 403 || code === 400) {
      return {
        status: code,
        isDailyQuota: false,
        message: `Gemini API key error (${code}): ${msg}. Please check your API key in Settings > Secrets.`,
      };
    }
    return {
      status: code >= 400 && code < 600 ? code : 500,
      isDailyQuota: false,
      message: msg,
    };
  } catch {
    if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429")) {
      return {
        status: 429,
        isDailyQuota,
        message:
          "Gemini API quota exceeded (429). Please check your API key tier in Settings > Secrets or retry shortly.",
      };
    }
    return { status: 500, isDailyQuota: false, message: raw };
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini API request timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), 20000);
    } catch (error: unknown) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : String(error);
      const isNonRetryable =
        errMsg.includes("API_KEY_INVALID") ||
        errMsg.includes("PERMISSION_DENIED") ||
        errMsg.includes("GenerateRequestsPerDay") ||
        errMsg.includes("400") ||
        errMsg.includes("403") ||
        errMsg.includes("404");
      if (isNonRetryable || attempt === maxAttempts) {
        throw error;
      }
      const delayMs = 500 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function generateWithGemini(
  ai: GoogleGenAI,
  params: Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">
) {
  const enrichedConfig = {
    ...params.config,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };
  const requestParams = { ...params, config: enrichedConfig };

  const skipPrimary = Date.now() < primaryDailyQuotaExhaustedUntil;
  if (!skipPrimary) {
    try {
      return await callWithRetry(
        () =>
          ai.models.generateContent({
            model: PRIMARY_MODEL,
            ...requestParams,
          }),
        2
      );
    } catch (err: unknown) {
      const { status, isDailyQuota } = extractGeminiError(err);
      if (status === 429 || status === 503 || status === 500) {
        if (isDailyQuota) {
          primaryDailyQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
        }
        return await callWithRetry(
          () =>
            ai.models.generateContent({
              model: FALLBACK_MODEL,
              ...requestParams,
            }),
          3
        );
      }
      throw err;
    }
  }

  return await callWithRetry(
    () =>
      ai.models.generateContent({
        model: FALLBACK_MODEL,
        ...requestParams,
      }),
    3
  );
}

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "campusconnect.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = FULL");

db.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL UNIQUE,
    reporter_name TEXT NOT NULL,
    reporter_email TEXT NOT NULL,
    location TEXT NOT NULL,
    complaint_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    assigned_department TEXT NOT NULL,
    sla_window TEXT NOT NULL,
    agent1_json TEXT NOT NULL,
    agent2_json TEXT NOT NULL,
    agent3_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

interface ComplaintRow {
  id: number;
  ticket_id: string;
  reporter_name: string;
  reporter_email: string;
  location: string;
  complaint_text: string;
  status: string;
  category: string;
  priority: string;
  assigned_department: string;
  sla_window: string;
  agent1_json: string;
  agent2_json: string;
  agent3_json: string;
  created_at: string;
  updated_at: string;
}

function rowToComplaint(row: ComplaintRow): ComplaintRecord {
  const rawAgent1 = JSON.parse(row.agent1_json) as Partial<Agent1Result>;
  const rawAgent2 = JSON.parse(row.agent2_json) as Partial<Agent2Result>;
  const rawAgent3 = JSON.parse(row.agent3_json) as Partial<Agent3Result>;

  const agent1: Agent1Result = {
    summary: rawAgent1.summary || row.complaint_text,
    category: rawAgent1.category || row.category,
    severity: (rawAgent1.severity as ComplaintSeverity) || (row.priority as ComplaintSeverity) || "Medium",
    sentiment: rawAgent1.sentiment || "Concerned",
    affectedArea: rawAgent1.affectedArea || row.location,
    keyEntities: Array.isArray(rawAgent1.keyEntities) ? rawAgent1.keyEntities : [],
  };

  const agent2: Agent2Result = {
    assignedDepartment: rawAgent2.assignedDepartment || row.assigned_department,
    secondaryTeam: rawAgent2.secondaryTeam || "None",
    slaWindow: rawAgent2.slaWindow || row.sla_window,
    escalationRequired: Boolean(rawAgent2.escalationRequired),
    investigationResult:
      rawAgent2.investigationResult ||
      rawAgent2.policyNotes ||
      "Routed for departmental inspection.",
    policyNotes: rawAgent2.policyNotes || "Standard campus triage policy applies.",
    staffActionSteps: Array.isArray(rawAgent2.staffActionSteps) ? rawAgent2.staffActionSteps : [],
  };

  const agent3: Agent3Result = {
    recommendedAction:
      rawAgent3.recommendedAction ||
      (agent2.staffActionSteps.length > 0
        ? agent2.staffActionSteps[0]
        : rawAgent3.expectedTimeline) ||
      `Assign ${agent2.assignedDepartment} to resolve within ${agent2.slaWindow}.`,
    officialResponse:
      rawAgent3.officialResponse ||
      `Ticket ${row.ticket_id} has been assigned to ${row.assigned_department}.`,
    expectedTimeline: rawAgent3.expectedTimeline || `Target SLA: ${row.sla_window}`,
    reporterNextSteps: Array.isArray(rawAgent3.reporterNextSteps)
      ? rawAgent3.reporterNextSteps
      : [],
    resolutionChecklist: Array.isArray(rawAgent3.resolutionChecklist)
      ? rawAgent3.resolutionChecklist
      : [],
  };

  return {
    id: row.id,
    ticketId: row.ticket_id,
    reporterName: row.reporter_name,
    reporterEmail: row.reporter_email,
    location: row.location,
    complaintText: row.complaint_text,
    status: (row.status as ComplaintStatus) || "Open",
    category: row.category,
    priority: (row.priority as ComplaintSeverity) || "Medium",
    assignedDepartment: row.assigned_department,
    slaWindow: row.sla_window,
    agent1,
    agent2,
    agent3,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Please configure GEMINI_API_KEY in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function generateUniqueTicketId(): string {
  const year = new Date().getFullYear();
  const checkStmt = db.prepare("SELECT 1 FROM complaints WHERE ticket_id = ?");
  for (let i = 0; i < 16; i++) {
    const token = crypto.randomBytes(3).toString("hex").toUpperCase();
    const candidate = `CC-${year}-${token}`;
    if (!checkStmt.get(candidate)) {
      return candidate;
    }
  }
  return `CC-${year}-${Date.now().toString(36).toUpperCase()}`;
}

// Agent 1: Complaint Analyzer
async function runComplaintAnalyzer(
  ai: GoogleGenAI,
  input: { reporterName: string; location: string; complaintText: string }
): Promise<Agent1Result> {
  const response = await generateWithGemini(ai, {
    contents: `Analyze this campus complaint submitted to CampusConnect.
Reporter: ${input.reporterName}
Location / Building: ${input.location}
Complaint: ${input.complaintText}`,
    config: {
      systemInstruction:
        "You are Agent 1 (Complaint Analyzer) for CampusConnect, a university campus operations portal. Classify the complaint into one category ('Facilities & Maintenance', 'IT & Network', 'Dining & Housing', 'Academic Services', 'Campus Safety', 'Transportation & Parking', or 'Student Affairs'), determine priority severity ('Low', 'Medium', 'High', or 'Critical'), assess reporter sentiment, identify the affected area, extract 3-5 key entities, and write a concise 1-2 sentence summary.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Concise 1-2 sentence analysis summary." },
          category: {
            type: Type.STRING,
            description:
              "One of: Facilities & Maintenance, IT & Network, Dining & Housing, Academic Services, Campus Safety, Transportation & Parking, Student Affairs",
          },
          severity: {
            type: Type.STRING,
            description: "One of: Low, Medium, High, Critical",
          },
          sentiment: {
            type: Type.STRING,
            description: "Short sentiment label e.g. Urgent, Frustrated, Concerned, Neutral",
          },
          affectedArea: {
            type: Type.STRING,
            description: "Specific campus facility, system, or service impacted.",
          },
          keyEntities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 to 5 key entities, assets, or issues extracted from the complaint.",
          },
        },
        required: ["summary", "category", "severity", "sentiment", "affectedArea", "keyEntities"],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as Agent1Result;
  const validSeverities: ComplaintSeverity[] = ["Low", "Medium", "High", "Critical"];
  const normalizedSeverity = validSeverities.includes(parsed.severity)
    ? parsed.severity
    : "Medium";

  return {
    summary: parsed.summary || input.complaintText.slice(0, 140),
    category: parsed.category || "Facilities & Maintenance",
    severity: normalizedSeverity,
    sentiment: parsed.sentiment || "Concerned",
    affectedArea: parsed.affectedArea || input.location,
    keyEntities: Array.isArray(parsed.keyEntities) ? parsed.keyEntities.slice(0, 6) : [],
  };
}

// Agent 2: Investigation Agent
async function runInvestigationAgent(
  ai: GoogleGenAI,
  input: { location: string; complaintText: string },
  agent1: Agent1Result
): Promise<Agent2Result> {
  const response = await generateWithGemini(ai, {
    contents: `Investigate root causes, department ownership, SLA, and operational impact for this analyzed complaint.
Location: ${input.location}
Original Complaint: ${input.complaintText}
Complaint Analyzer Output: ${JSON.stringify(agent1)}`,
    config: {
      systemInstruction:
        "You are Agent 2 (Investigation Agent) for CampusConnect. Investigate the likely technical or operational root cause, assign the primary responsible campus department, identify an optional secondary support team, determine an explicit target SLA window (e.g., '2 hours', '4 hours', '24 hours'), indicate whether immediate escalation is required, write a clear 2-3 sentence investigationResult summarizing probable cause and scope, note relevant campus policy, and provide 3 concrete diagnostic/staff steps.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assignedDepartment: {
            type: Type.STRING,
            description: "Primary responsible campus department.",
          },
          secondaryTeam: {
            type: Type.STRING,
            description: "Supporting unit or 'None' if single-department.",
          },
          slaWindow: {
            type: Type.STRING,
            description: "Target response/triage SLA window, e.g. '4 hours' or '24 hours'.",
          },
          escalationRequired: {
            type: Type.BOOLEAN,
            description: "True if safety, accessibility, or critical outage requires immediate escalation.",
          },
          investigationResult: {
            type: Type.STRING,
            description: "Clear 2-3 sentence investigation finding detailing probable root cause and impact.",
          },
          policyNotes: {
            type: Type.STRING,
            description: "Relevant campus policy, safety, or compliance guidance.",
          },
          staffActionSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 concise diagnostic and operational investigation steps for campus staff.",
          },
        },
        required: [
          "assignedDepartment",
          "secondaryTeam",
          "slaWindow",
          "escalationRequired",
          "investigationResult",
          "policyNotes",
          "staffActionSteps",
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as Agent2Result;
  return {
    assignedDepartment: parsed.assignedDepartment || "Campus Operations",
    secondaryTeam: parsed.secondaryTeam || "Student Support Desk",
    slaWindow: parsed.slaWindow || "24 hours",
    escalationRequired: Boolean(parsed.escalationRequired),
    investigationResult:
      parsed.investigationResult ||
      parsed.policyNotes ||
      `Preliminary investigation indicates an issue affecting ${agent1.affectedArea} requiring inspection by ${parsed.assignedDepartment || "Campus Operations"}.`,
    policyNotes: parsed.policyNotes || "Standard campus service-level triage applies.",
    staffActionSteps: Array.isArray(parsed.staffActionSteps)
      ? parsed.staffActionSteps.slice(0, 5)
      : [],
  };
}

// Agent 3: Action Agent
async function runActionAgent(
  ai: GoogleGenAI,
  input: { ticketId: string; reporterName: string; location: string; complaintText: string },
  agent1: Agent1Result,
  agent2: Agent2Result
): Promise<Agent3Result> {
  const response = await generateWithGemini(ai, {
    contents: `Create the recommended action plan and official response for this CampusConnect ticket.
Ticket ID: ${input.ticketId}
Reporter Name: ${input.reporterName}
Location: ${input.location}
Complaint: ${input.complaintText}
Complaint Analyzer Output: ${JSON.stringify(agent1)}
Investigation Agent Output: ${JSON.stringify(agent2)}`,
    config: {
      systemInstruction:
        "You are Agent 3 (Action Agent) for CampusConnect. Produce a concrete 1-2 sentence recommendedAction summarizing the immediate remediation plan, write a polite officialResponse addressed to the reporter referencing their Ticket ID, department, and SLA, state the expectedTimeline, list 2-3 reporterNextSteps, and provide a 3-step resolutionChecklist for staff before closing the ticket.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedAction: {
            type: Type.STRING,
            description: "Clear, actionable 1-2 sentence primary remediation action recommended for the team.",
          },
          officialResponse: {
            type: Type.STRING,
            description: "Polite, actionable response sent to the reporter referencing the ticket ID.",
          },
          expectedTimeline: {
            type: Type.STRING,
            description: "Clear summary of when the reporter can expect inspection/resolution.",
          },
          reporterNextSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 short next steps for the reporter.",
          },
          resolutionChecklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 verification steps campus staff must confirm before closing the ticket.",
          },
        },
        required: [
          "recommendedAction",
          "officialResponse",
          "expectedTimeline",
          "reporterNextSteps",
          "resolutionChecklist",
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? "{}").trim()) as Agent3Result;
  return {
    recommendedAction:
      parsed.recommendedAction ||
      `Dispatch ${agent2.assignedDepartment} to inspect ${agent1.affectedArea} and resolve within ${agent2.slaWindow}.`,
    officialResponse:
      parsed.officialResponse ||
      `Thank you, ${input.reporterName}. Your complaint (${input.ticketId}) has been routed to ${agent2.assignedDepartment}.`,
    expectedTimeline: parsed.expectedTimeline || `Initial response within ${agent2.slaWindow}.`,
    reporterNextSteps: Array.isArray(parsed.reporterNextSteps)
      ? parsed.reporterNextSteps.slice(0, 4)
      : [],
    resolutionChecklist: Array.isArray(parsed.resolutionChecklist)
      ? parsed.resolutionChecklist.slice(0, 4)
      : [],
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      database: "connected",
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get("/api/complaints", (req: Request, res: Response) => {
    try {
      const statusFilter = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const searchQuery = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

      const rows = db
        .prepare("SELECT * FROM complaints ORDER BY id DESC")
        .all() as ComplaintRow[];

      let records = rows.map(rowToComplaint);

      if (statusFilter && statusFilter !== "All") {
        records = records.filter((item) => item.status === statusFilter);
      }

      if (searchQuery) {
        records = records.filter(
          (item) =>
            item.ticketId.toLowerCase().includes(searchQuery) ||
            item.location.toLowerCase().includes(searchQuery) ||
            item.category.toLowerCase().includes(searchQuery) ||
            item.assignedDepartment.toLowerCase().includes(searchQuery) ||
            item.complaintText.toLowerCase().includes(searchQuery) ||
            item.reporterName.toLowerCase().includes(searchQuery)
        );
      }

      res.json({ complaints: records });
    } catch (error) {
      console.error("Failed to fetch complaints:", error);
      res.status(500).json({ error: "Failed to load complaints from the database." });
    }
  });

  app.get("/api/complaints/:ticketId", (req: Request, res: Response) => {
    try {
      const ticketId = String(req.params.ticketId || "").trim();
      const row = db
        .prepare("SELECT * FROM complaints WHERE UPPER(ticket_id) = UPPER(?)")
        .get(ticketId) as ComplaintRow | undefined;

      if (!row) {
        res.status(404).json({ error: `Ticket ${ticketId} not found.` });
        return;
      }

      res.json({ complaint: rowToComplaint(row) });
    } catch (error) {
      console.error("Failed to fetch ticket:", error);
      res.status(500).json({ error: "Failed to retrieve complaint record." });
    }
  });

  app.post("/api/complaints", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reporterName = String(body.reporterName ?? "").trim();
      const reporterEmail = String(body.reporterEmail ?? "").trim();
      const location = String(body.location ?? "").trim();
      const complaintText = String(body.complaintText ?? "").trim();

      if (!reporterName || !reporterEmail || !location || !complaintText) {
        res.status(400).json({
          error:
            "All required fields must be filled: Reporter Name, Campus Email, Building or Campus Location, and Complaint Details.",
        });
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
        res.status(400).json({
          error: "Please enter a valid campus email address.",
        });
        return;
      }

      if (complaintText.length < 10) {
        res.status(400).json({
          error:
            "Please provide at least 10 characters in Complaint Details so the AI agents can analyze it.",
        });
        return;
      }

      const ai = getGeminiClient();
      const ticketId = generateUniqueTicketId();

      // Sequential 3-Agent AI Pipeline: Complaint Analyzer -> Investigation Agent -> Action Agent
      const agent1 = await runComplaintAnalyzer(ai, {
        reporterName,
        location,
        complaintText,
      });

      const agent2 = await runInvestigationAgent(
        ai,
        {
          location,
          complaintText,
        },
        agent1
      );

      const agent3 = await runActionAgent(
        ai,
        {
          ticketId,
          reporterName,
          location,
          complaintText,
        },
        agent1,
        agent2
      );

      const now = new Date().toISOString();
      const insertStmt = db.prepare(`
        INSERT INTO complaints (
          ticket_id,
          reporter_name,
          reporter_email,
          location,
          complaint_text,
          status,
          category,
          priority,
          assigned_department,
          sla_window,
          agent1_json,
          agent2_json,
          agent3_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const saveComplaint = db.transaction(() => {
        const info = insertStmt.run(
          ticketId,
          reporterName,
          reporterEmail,
          location,
          complaintText,
          "Open",
          agent1.category,
          agent1.severity,
          agent2.assignedDepartment,
          agent2.slaWindow,
          JSON.stringify(agent1),
          JSON.stringify(agent2),
          JSON.stringify(agent3),
          now,
          now
        );
        return db
          .prepare("SELECT * FROM complaints WHERE id = ?")
          .get(info.lastInsertRowid) as ComplaintRow;
      });

      const savedRow = saveComplaint();
      res.status(201).json({ complaint: rowToComplaint(savedRow) });
    } catch (error: unknown) {
      console.error("Complaint submission failed:", error);
      const { status, message } = extractGeminiError(error);
      res.status(status).json({ error: message });
    }
  });

  app.patch("/api/complaints/:ticketId", (req: Request, res: Response) => {
    try {
      const ticketId = String(req.params.ticketId || "").trim();
      const nextStatus = String((req.body as Record<string, unknown>)?.status ?? "").trim();
      const allowedStatuses: ComplaintStatus[] = ["Open", "In Progress", "Resolved"];

      if (!allowedStatuses.includes(nextStatus as ComplaintStatus)) {
        res.status(400).json({ error: "Status must be Open, In Progress, or Resolved." });
        return;
      }

      const now = new Date().toISOString();
      const result = db
        .prepare("UPDATE complaints SET status = ?, updated_at = ? WHERE ticket_id = ?")
        .run(nextStatus, now, ticketId);

      if (result.changes === 0) {
        res.status(404).json({ error: `Ticket ${ticketId} not found.` });
        return;
      }

      const updated = db
        .prepare("SELECT * FROM complaints WHERE ticket_id = ?")
        .get(ticketId) as ComplaintRow;

      res.json({ complaint: rowToComplaint(updated) });
    } catch (error) {
      console.error("Failed to update complaint status:", error);
      res.status(500).json({ error: "Failed to update ticket status." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CampusConnect server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start CampusConnect server:", err);
  process.exit(1);
});
