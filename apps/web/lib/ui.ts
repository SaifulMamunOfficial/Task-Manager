export type PosRef = { id: string; title: string; titleBn?: string | null; level: number };
export type Position = { id: string; isPrimary: boolean; unit: { id: string; name: string }; position: PosRef };
export type Me = { id: string; name: string; email: string; isAdmin: boolean; mustChangePassword: boolean; language: 'bn' | 'en'; positions: Position[] };
export type Brief = { id: string; name: string };

// Colour of the status pill. Labels come from the language dictionary (`status.<STATUS>`).
export const STATUS_TONE: Record<string, string> = {
  PENDING_ACCEPTANCE: 'amber', ACCEPTED: 'blue', IN_PROGRESS: 'blue', BLOCKED: 'red', SUBMITTED: 'amber', APPROVED: 'green', DECLINED: 'red', CANCELLED: 'gray',
};

export const OPEN = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'];
export const WORKING = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED'];

export const isOverdue = (due?: string | null, status?: string) =>
  !!due && new Date(due) < new Date() && !['APPROVED', 'CANCELLED', 'DECLINED', 'SUBMITTED'].includes(status ?? '');
