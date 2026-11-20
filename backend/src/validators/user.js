import { z } from 'zod';
import { objectId } from './auth.js';

const roles = ['super_admin', 'team_leader', 'employee'];

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().max(20).optional().default(''),
  designation: z.string().trim().max(80).optional().default(''),
  role: z.enum(roles),
  department: objectId.nullable().optional(),
  manager: objectId.nullable().optional(),
  teamLeader: objectId.nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const userUpdateSchema = userCreateSchema.partial().omit({ password: true }).extend({
  password: z.string().min(8).max(100).optional(),
});
