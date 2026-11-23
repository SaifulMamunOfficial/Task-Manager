export type Lang = 'bn' | 'en';
export type PosRef = { id: string; title: string; titleBn?: string | null; level: number };
export type Position = { id: string; isPrimary: boolean; unit: { id: string; name: string; nameBn?: string | null }; secretariat?: { id: string; name: string; nameBn?: string | null } | null; position: PosRef };
export type Me = { id: string; name: string; nameBn?: string | null; email: string; isAdmin: boolean; mustChangePassword: boolean; language: Lang; positions: Position[] };
export type Brief = { id: string; name: string; nameBn?: string | null };

export type Task = { id: string; title: string; description?: string | null; priority: 'LOW' | 'NORMAL' | 'URGENT'; dueDate: string | null; createdById: string };
export type Assignment = {
  id: string;
  taskId: string;
  status: string;
  progressPercent: number;
  assigneeId: string;
  assignedById: string;
  createdAt: string;
  task: Task;
  assignee?: Brief;
  assignedBy?: Brief;
};
export type FileMeta = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedById: string; createdAt: string };
export type UpdateRow = { id: string; type: 'COMMENT' | 'STATUS_CHANGE' | 'PROGRESS'; body: string | null; meta: { to?: string; from?: string; progressPercent?: number } | null; createdAt: string; user: Brief; attachments: FileMeta[] };
export type Detail = {
  role: 'assignee' | 'giver';
  visibilityMode: string;
  assignment: Assignment;
  updates: UpdateRow[];
  notes: { id: string; body: string; createdAt: string; user: Brief }[];
  taskAttachments: FileMeta[];
  chain: null | { summary?: { total: number; approved: number; open: number; overdue: number }; rows?: { id: string; depth: number; status: string; progress: number; due: string | null; title: string; assignee: string; givenBy: string }[] };
};
export type Notif = { id: string; type: string; payload: any; readAt: string | null; createdAt: string };
export type Person = { id: string; name: string; nameBn?: string | null; positions: { position: PosRef; unit: { name: string; nameBn?: string | null } }[] };
export type Prefs = {
  notifyEmail: boolean;
  notifyPush: boolean;
  email: string;
  emailAvailable: boolean;
  webPushAvailable: boolean;
  mobilePushAvailable: boolean;
};

export const OPEN = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'];

/** Which status changes the assignee / giver may make (same rules as the server). */
export const ASSIGNEE_TRANSITIONS: Record<string, string[]> = {
  PENDING_ACCEPTANCE: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['IN_PROGRESS', 'BLOCKED', 'SUBMITTED'],
  IN_PROGRESS: ['BLOCKED', 'SUBMITTED'],
  BLOCKED: ['IN_PROGRESS', 'SUBMITTED'],
};
export const GIVER_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['APPROVED', 'IN_PROGRESS'],
  DECLINED: ['PENDING_ACCEPTANCE'],
  PENDING_ACCEPTANCE: ['CANCELLED'],
  ACCEPTED: ['CANCELLED'],
  IN_PROGRESS: ['CANCELLED'],
  BLOCKED: ['CANCELLED'],
};
