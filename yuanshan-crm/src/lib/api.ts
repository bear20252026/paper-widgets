import type {
  Activity,
  Client,
  ClientDetailPayload,
  ClientPatch,
  NewClientInput,
  Stage,
} from "./types";
import { seedActivities, seedClients, seedConsultants } from "./seed";

const STORAGE_KEY = "yuanshan-crm-demo:v1";

interface Db {
  clients: Client[];
  activities: Activity[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadDb(): Db {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Db;
        if (Array.isArray(parsed.clients) && Array.isArray(parsed.activities)) return parsed;
      }
    } catch {
      // fall through to the seed
    }
  }
  const seeded: Db = { clients: clone(seedClients), activities: clone(seedActivities) };
  persist(seeded);
  return seeded;
}

function persist(db: Db) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // storage can be full or blocked; the in-memory copy still works
  }
}

let db: Db = loadDb();

function save() {
  persist(db);
}

const wait = (ms = 90) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
}

function touchClient(id: number, occurredAt: string) {
  const client = db.clients.find((item) => item.id === id);
  if (!client) return;
  client.lastActivityAt = occurredAt;
  client.updatedAt = occurredAt;
}

function logStageChange(client: Client, from: Stage, to: Stage, at: string) {
  db.activities.push({
    id: nextId(db.activities),
    clientId: client.id,
    kind: to === "won" ? "deal_won" : "stage_change",
    title: "",
    body: "",
    occurredAt: at,
    authorId: client.consultantId,
    fromStage: from,
    toStage: to,
  });
}

export const api = {
  consultants: {
    async list() {
      await wait(40);
      return clone(seedConsultants);
    },
    async avatarPool() {
      await wait(20);
      return [] as string[];
    },
  },

  clients: {
    async list(): Promise<Client[]> {
      await wait();
      return clone(
        [...db.clients].sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")),
      );
    },

    async get(id: number): Promise<ClientDetailPayload | null> {
      await wait();
      const client = db.clients.find((item) => item.id === id);
      if (!client) return null;
      const timeline = db.activities
        .filter((activity) => activity.clientId === id)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      return { client: clone(client), timeline: clone(timeline) };
    },

    async create(input: NewClientInput): Promise<Client> {
      await wait();
      const timestamp = nowIso();
      const client: Client = {
        ...input,
        id: nextId(db.clients),
        logoKey: input.logoKey || slugify(input.company) || `client-${Date.now()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastActivityAt: null,
      };
      db.clients.push(client);
      save();
      return clone(client);
    },

    async update(id: number, patch: ClientPatch): Promise<Client> {
      await wait();
      const client = db.clients.find((item) => item.id === id);
      if (!client) throw new Error("Client not found");
      const timestamp = nowIso();
      const previousStage = client.stage;

      Object.assign(client, patch, { updatedAt: timestamp });

      if (patch.stage && patch.stage !== previousStage) {
        logStageChange(client, previousStage, patch.stage, timestamp);
        client.closedAt = patch.stage === "won" ? timestamp : null;
        client.nextFollowUpAt = patch.stage === "won" ? null : client.nextFollowUpAt;
      }

      save();
      return clone(client);
    },

    async move(id: number, stage: Stage): Promise<Client> {
      return api.clients.update(id, { stage });
    },

    async remove(id: number): Promise<void> {
      await wait();
      db.clients = db.clients.filter((item) => item.id !== id);
      db.activities = db.activities.filter((activity) => activity.clientId !== id);
      save();
    },
  },

  activities: {
    async recent(): Promise<Activity[]> {
      await wait(60);
      return clone(
        [...db.activities]
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .slice(0, 8),
      );
    },

    async add(input: {
      clientId: number;
      kind: Activity["kind"];
      title: string;
      body: string;
      occurredAt: string;
      authorId: number;
      nextFollowUpAt?: string | null;
    }): Promise<Activity> {
      await wait();
      const activity: Activity = {
        id: nextId(db.activities),
        clientId: input.clientId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        occurredAt: input.occurredAt,
        authorId: input.authorId,
      };
      db.activities.push(activity);
      touchClient(input.clientId, input.occurredAt);
      if (input.nextFollowUpAt !== undefined) {
        const client = db.clients.find((item) => item.id === input.clientId);
        if (client) client.nextFollowUpAt = input.nextFollowUpAt;
      }
      save();
      return clone(activity);
    },

    async remove(id: number): Promise<void> {
      await wait();
      db.activities = db.activities.filter((activity) => activity.id !== id);
      save();
    },
  },

  reset() {
    db = { clients: clone(seedClients), activities: clone(seedActivities) };
    save();
  },
};

export const queryKeys = {
  consultants: ["consultants"] as const,
  clients: ["clients"] as const,
  client: (id: number) => ["clients", id] as const,
  recentActivities: ["activities", "recent"] as const,
};
