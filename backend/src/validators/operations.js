import { z } from 'zod';
import { objectId } from './auth.js';

export const attendanceMarkSchema = z.object({
  employee: objectId,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'late', 'absent']),
  note: z.string().trim().max(500).optional().default(''),
});

export const timesheetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.coerce.number().min(0.25).max(24),
  task: objectId.nullable().optional(),
  description: z.string().trim().min(3).max(2000),
});

export const timesheetReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(2000).optional().default(''),
});
