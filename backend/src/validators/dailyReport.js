import { z } from 'zod';
import { objectId } from './auth.js';

export const reportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignedWork: z.string().trim().min(3).max(4000),
  completedWork: z.string().trim().min(3).max(4000),
  pendingWork: z.string().trim().min(1).max(4000),
  problems: z.string().trim().max(4000).optional().default(''),
  progress: z.coerce.number().min(0).max(100),
  tomorrowPlan: z.string().trim().min(3).max(4000),
  links: z.array(z.string().trim().min(3).max(500)).max(10).optional().default([]),
  tasks: z.array(objectId).max(20).optional().default([]),
});

export const reportReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  note: z.string().trim().max(2000).optional().default(''),
});
