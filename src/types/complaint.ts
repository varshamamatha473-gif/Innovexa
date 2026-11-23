export type ComplaintStatus = "Open" | "In Progress" | "Resolved";

export type ComplaintSeverity = "Low" | "Medium" | "High" | "Critical";

export interface Agent1Result {
  summary: string;
  category: string;
  severity: ComplaintSeverity;
  sentiment: string;
  affectedArea: string;
  keyEntities: string[];
}

export interface Agent2Result {
  assignedDepartment: string;
  secondaryTeam: string;
  slaWindow: string;
  escalationRequired: boolean;
  investigationResult: string;
  policyNotes: string;
  staffActionSteps: string[];
}

export interface Agent3Result {
  recommendedAction: string;
  officialResponse: string;
  expectedTimeline: string;
  reporterNextSteps: string[];
  resolutionChecklist: string[];
}

export interface ComplaintRecord {
  id: number;
  ticketId: string;
  reporterName: string;
  reporterEmail: string;
  location: string;
  complaintText: string;
  status: ComplaintStatus;
  category: string;
  priority: ComplaintSeverity;
  assignedDepartment: string;
  slaWindow: string;
  agent1: Agent1Result;
  agent2: Agent2Result;
  agent3: Agent3Result;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitComplaintPayload {
  reporterName: string;
  reporterEmail: string;
  location: string;
  complaintText: string;
}
