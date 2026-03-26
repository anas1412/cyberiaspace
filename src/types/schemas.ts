import { z } from 'zod';

export const StatusSchema = z.enum(['none', 'todo', 'doing', 'done']);
export const PrioritySchema = z.enum(['none', 'low', 'medium', 'high', 'urgent']);

export const TaskItemSchema = z.object({
  text: z.string().min(1),
  done: z.boolean().default(false),
});

export const OracleThoughtSchema = z.object({
  text: z.string().optional().default(''),
  type: z.enum(['label', 'text', 'tasks', 'paint', 'table', 'image', 'embed', 'file']),
  content: z.string().optional(),
  description: z.string().optional().default(''),
  stackName: z.string().nullable().optional(),
  status: StatusSchema.optional().default('none'),
  priority: PrioritySchema.optional().default('none'),
  startTime: z.number().nullable().optional(),
  endTime: z.number().nullable().optional(),
  isAllDay: z.boolean().optional().default(true),
  location: z.string().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  reminders: z.array(z.object({ time: z.number(), type: z.string() })).optional().default([]),
  tasks: z.array(TaskItemSchema).optional(),
  table: z.array(z.array(z.string())).optional(),
  drawing: z.string().optional(),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
}).refine(data => {
  if (data.type === 'tasks' && (!data.tasks || data.tasks.length === 0)) {
    return false;
  }
  if (data.type === 'table' && (!data.table || data.table.length === 0)) {
    return false;
  }
  if (data.type === 'embed' && !data.content) {
    return false;
  }
  return true;
}, {
  message: "Missing required data for the selected thought type. (e.g., 'tasks' requires a non-empty tasks array, 'embed' requires a URL in 'content')",
});

export const CreateThoughtsSchema = z.object({
  items: z.array(OracleThoughtSchema).min(1),
});

export const UpdateThoughtsSchema = z.object({
  ids: z.array(z.string()).min(1),
  text: z.string().optional(),
  type: z.enum(['label', 'text', 'tasks', 'paint', 'table', 'image', 'embed', 'file']).optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  startTime: z.number().nullable().optional(),
  endTime: z.number().nullable().optional(),
  isAllDay: z.boolean().optional(),
  location: z.string().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  reminders: z.array(z.object({ time: z.number(), type: z.string() })).optional(),
  tasks: z.array(TaskItemSchema).optional(),
  table: z.array(z.array(z.string())).optional(),
  drawing: z.string().optional(),
  stackName: z.string().nullable().optional(),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
});

export const CreateStackSchema = z.object({
  name: z.string().min(1),
  ids: z.array(z.string()).min(1),
});

export const LinkThoughtsSchema = z.object({
  ids: z.array(z.string()).min(1),
  name: z.string().optional(),
});

export const UnlinkThoughtsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const ReadFilesContentSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const GetThoughtDetailsSchema = z.object({
  ids: z.array(z.string()).min(1),
});
