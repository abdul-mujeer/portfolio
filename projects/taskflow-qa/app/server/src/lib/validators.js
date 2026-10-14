import { z } from 'zod';
import { isRealCalendarDate } from './datetime.js';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED'];
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const PROJECT_KEY_RE = /^[A-Z]{2,6}$/;
export const MEMBER_ROLES = ['OWNER', 'ADMIN', 'MEMBER'];

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 10 characters and contain an uppercase letter, a lowercase letter and a digit';

const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address');

const passwordSchema = z
  .string()
  .min(10, PASSWORD_POLICY_MESSAGE)
  .max(200)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE);

/** Status workflow: strictly linear forward steps, CANCELED from any non-DONE state. */
export const STATUS_TRANSITIONS = {
  TODO: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['IN_REVIEW', 'CANCELED'],
  IN_REVIEW: ['DONE', 'CANCELED'],
  DONE: [],
  CANCELED: [],
};

// ---------------------------------------------------------------- body schemas

export const registerSchema = z
  .object({
    email: emailSchema,
    display_name: z.string().trim().min(2).max(80),
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(200),
  })
  .strict();

export const projectCreateSchema = z
  .object({
    key: z
      .string()
      .regex(PROJECT_KEY_RE, 'Project key must be 2-6 uppercase letters (A-Z)'),
    name: z.string().trim().min(3, 'Name must be at least 3 characters').max(100),
    description: z.string().max(500).nullable().optional().default(null),
  })
  .strict();

export const projectUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: 'Provide at least one field to update (name, description)',
  });

export const memberAddSchema = z
  .object({
    email: emailSchema,
    role: z.enum(['ADMIN', 'MEMBER'], {
      errorMap: () => ({
        message:
          'Role must be ADMIN or MEMBER; use POST /projects/:id/transfer to hand over ownership',
      }),
    }),
  })
  .strict();

export const memberRoleSchema = z
  .object({
    role: z.enum(['ADMIN', 'MEMBER'], {
      errorMap: () => ({
        message:
          'Role must be ADMIN or MEMBER; use POST /projects/:id/transfer to hand over ownership',
      }),
    }),
  })
  .strict();

export const transferSchema = z.object({ userId: z.number().int().positive() }).strict();

const titleSchema = z
  .string()
  .refine((v) => v.trim().length >= 3 && v.trim().length <= 120, {
    message: 'Title must be 3-120 characters after trimming',
  });

const descriptionSchema = z
  .string()
  .max(2000, 'Description must be at most 2000 characters')
  .nullable();

const dueDateSchema = z
  .string()
  .refine(isRealCalendarDate, 'Due date must be a real calendar date (YYYY-MM-DD)')
  .nullable();

const estimatedHoursSchema = z
  .number({ invalid_type_error: 'estimatedHours must be a number' })
  .refine((v) => v >= 0.5 && v <= 100, 'estimatedHours must be between 0.5 and 100')
  .refine((v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9, {
    message: 'estimatedHours must be in 0.5 steps',
  })
  .nullable();

export const taskCreateSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional().default(null),
    priority: z.enum(TASK_PRIORITIES, {
      errorMap: () => ({ message: `Priority must be one of ${TASK_PRIORITIES.join(', ')}` }),
    }).optional().default('MEDIUM'),
    assigneeId: z
      .number({ invalid_type_error: 'assigneeId must be a number' })
      .int()
      .positive()
      .nullable()
      .optional()
      .default(null),
    dueDate: dueDateSchema.optional().default(null),
    estimatedHours: estimatedHoursSchema.optional().default(null),
  })
  .strict();

export const taskUpdateSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    priority: z
      .enum(TASK_PRIORITIES, {
        errorMap: () => ({ message: `Priority must be one of ${TASK_PRIORITIES.join(', ')}` }),
      })
      .optional(),
    assigneeId: z
      .number({ invalid_type_error: 'assigneeId must be a number' })
      .int()
      .positive()
      .nullable()
      .optional(),
    dueDate: dueDateSchema.optional(),
    estimatedHours: estimatedHoursSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export const taskStatusSchema = z.object({ status: z.enum(TASK_STATUSES) }).strict();

export const commentCreateSchema = z
  .object({
    body: z
      .string()
      .refine((v) => v.trim().length >= 1 && v.trim().length <= 1000, {
        message: 'Comment body must be 1-1000 characters after trimming',
      }),
  })
  .strict();

// --------------------------------------------------------------- query schemas

const pageSchema = z.coerce
  .number({ invalid_type_error: 'page must be a number' })
  .int('page must be an integer')
  .min(1, 'page must be >= 1')
  .optional()
  .default(1);

const limitSchema = z.coerce
  .number({ invalid_type_error: 'limit must be a number' })
  .int('limit must be an integer')
  .min(1, 'limit must be >= 1')
  .max(100, 'limit must be <= 100')
  .optional()
  .default(20);

export const paginationQuerySchema = z
  .object({ page: pageSchema, limit: limitSchema })
  .strict();

export const projectListQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    archived: z.enum(['true', 'false']).optional(),
  })
  .strict();

export const taskListQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.coerce
      .number({ invalid_type_error: 'assigneeId must be a number' })
      .int()
      .positive()
      .optional(),
    q: z.string().max(200, 'q must be at most 200 characters').optional(),
    dueBefore: z
      .string()
      .refine(isRealCalendarDate, 'dueBefore must be a real calendar date (YYYY-MM-DD)')
      .optional(),
    overdue: z.enum(['true', 'false'], { errorMap: () => ({ message: 'overdue must be true or false' }) }).optional(),
    sort: z
      .enum(['id', 'created_at', 'updated_at', 'due_date', 'priority', 'title', 'status'])
      .optional()
      .default('created_at'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();
