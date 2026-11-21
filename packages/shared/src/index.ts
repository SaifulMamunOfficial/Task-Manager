export const AssignmentStatus = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  SUBMITTED: 'SUBMITTED', // assignee says done, waiting for giver's approval
  APPROVED: 'APPROVED', // giver approved: closed
  DECLINED: 'DECLINED', // assignee sent it back with a reason
  CANCELLED: 'CANCELLED',
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const Priority = { LOW: 'LOW', NORMAL: 'NORMAL', URGENT: 'URGENT' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const VisibilityMode = { DIRECT: 'DIRECT', SUMMARY: 'SUMMARY', FULL: 'FULL' } as const;
export type VisibilityMode = (typeof VisibilityMode)[keyof typeof VisibilityMode];

export const VisibilityScope = { GLOBAL: 'GLOBAL', POSITION: 'POSITION', USER: 'USER' } as const;
export type VisibilityScope = (typeof VisibilityScope)[keyof typeof VisibilityScope];

export interface VisibilitySettingRow {
  scope: VisibilityScope;
  scopeRefId: string | null;
  mode: VisibilityMode;
}

/**
 * Resolve how much of a delegation chain a task giver may see.
 * Priority: USER override > POSITION (strongest mode among the user's positions) > GLOBAL > DIRECT.
 */
export function resolveVisibilityMode(
  settings: VisibilitySettingRow[],
  userId: string,
  positionIds: string[],
): VisibilityMode {
  const user = settings.find((s) => s.scope === 'USER' && s.scopeRefId === userId);
  if (user) return user.mode;
  const rank: Record<VisibilityMode, number> = { DIRECT: 0, SUMMARY: 1, FULL: 2 };
  const byPosition = settings
    .filter((s) => s.scope === 'POSITION' && s.scopeRefId && positionIds.includes(s.scopeRefId))
    .sort((a, b) => rank[b.mode] - rank[a.mode])[0];
  if (byPosition) return byPosition.mode;
  const global = settings.find((s) => s.scope === 'GLOBAL');
  return global ? global.mode : 'DIRECT';
}

/** Assignment state machine: which status changes the assignee / giver may make. */
export const ASSIGNEE_TRANSITIONS: Record<string, AssignmentStatus[]> = {
  PENDING_ACCEPTANCE: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['IN_PROGRESS', 'BLOCKED', 'SUBMITTED'],
  IN_PROGRESS: ['BLOCKED', 'SUBMITTED'],
  BLOCKED: ['IN_PROGRESS', 'SUBMITTED'],
  DECLINED: [],
  SUBMITTED: [],
  APPROVED: [],
  CANCELLED: [],
};
export const GIVER_TRANSITIONS: Record<string, AssignmentStatus[]> = {
  SUBMITTED: ['APPROVED', 'IN_PROGRESS'], // approve, or send back for more work
  DECLINED: ['PENDING_ACCEPTANCE'], // re-send after clarifying
  PENDING_ACCEPTANCE: ['CANCELLED'],
  ACCEPTED: ['CANCELLED'],
  IN_PROGRESS: ['CANCELLED'],
  BLOCKED: ['CANCELLED'],
};

export const DEFAULT_POSITIONS = [
  { title: 'Director', level: 1 },
  { title: 'Assistant Director', level: 2 },
  { title: 'Secretary', level: 3 },
  { title: 'Unit Head', level: 3 },
  { title: 'Member', level: 4 },
];
