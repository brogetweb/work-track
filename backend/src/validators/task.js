import { z } from 'zod';
import { objectId } from './auth.js';

export const taskCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(8000).optional().default(''),
  department: objectId,
  category: z.string().trim().max(60).optional().default(''),
  assignedTo: objectId,
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  startDate: z.string().min(8).optional().nullable(),
  deadline: z.string().min(8).optional().nullable(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed']).optional().default('pending'),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(8000).optional(),
  department: objectId.optional(),
  category: z.string().trim().max(60).optional(),
  assignedTo: objectId.optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  startDate: z.string().min(8).nullable().optional(),
  deadline: z.string().min(8).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'review', 'completed']).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  note: z.string().trim().max(2000).optional().default(''),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
