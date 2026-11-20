import { z } from 'zod';

export const roleUpdateSchema = z.object({
  permissions: z.array(z.string().min(3).max(60)).max(80),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(3).max(60),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
});
