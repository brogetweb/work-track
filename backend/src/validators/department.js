import { z } from 'zod';
import { objectId } from './auth.js';

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(12),
  description: z.string().trim().max(500).optional().default(''),
  manager: objectId.nullable().optional(),
  categories: z.array(z.string().trim().min(1).max(60)).max(20).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const departmentUpdateSchema = departmentSchema.partial();
