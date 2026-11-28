export type Stage = "lead" | "contact" | "proposal" | "negotiation" | "won";

export const STAGES: Stage[] = ["lead", "contact", "proposal", "negotiation", "won"];

export const STAGE_META: Record<Stage, { color: string; soft: string; probability: number }> = {
  lead: { color: "#9DBBAB", soft: "#EEF4F0", probability: 0.1 },
  contact: { color: "#6E9E8A", soft: "#E7F0EB", probability: 0.25 },
  proposal: { color: "#4A8270", soft: "#E1ECE7", probability: 0.5 },
  negotiation: { color: "#2F5E4F", soft: "#DCE7E2", probability: 0.75 },
  won: { color: "#1E3A32", soft: "#F5EED6", probability: 1 },
};

export type ActivityKind = "call" | "meeting" | "email" | "note" | "stage_change" | "deal_won";

export interface Consultant {
  id: number;
  name: string;
  title: string;
  color: string;
  avatarUrl?: string;
}

export interface Activity {
  id: number;
  clientId: number;
  kind: ActivityKind;
  title: string;
  body: string;
  occurredAt: string;
  authorId: number;
  fromStage?: Stage;
  toStage?: Stage;
}

export interface Client {
  id: number;
  company: string;
  industry: string;
  city?: string;
  logoKey: string;
  contactName: string;
  contactTitle?: string;
  contactAvatarUrl?: string;
  email?: string;
  phone?: string;
  projectName?: string;
  amount: number;
  stage: Stage;
  consultantId: number;
  nextFollowUpAt?: string | null;
  expectedCloseAt?: string | null;
  closedAt?: string | null;
  notes?: string;
  lastActivityAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetailPayload {
  client: Client;
  timeline: Activity[];
}

export type NewClientInput = Omit<
  Client,
  "id" | "createdAt" | "updatedAt" | "lastActivityAt" | "closedAt"
> & {
  closedAt?: string | null;
};

export type ClientPatch = Partial<Omit<Client, "id" | "createdAt">>;
