import { z } from 'zod';
import { Priority, TaskStatus } from '@prisma/client';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Title is too long'),
  description: z.string().optional().nullable(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  dueDate: z.string().datetime().optional().nullable().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, { message: 'Due date cannot be in the past' }),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Title is too long').optional(),
  description: z.string().optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().datetime().optional().nullable().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, { message: 'Due date cannot be in the past' }),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  labelIds: z.array(z.string().uuid()).optional(),
  isArchived: z.boolean().optional(),
});

export const moveTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  position: z.number({ required_error: 'Position number is required' }),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty'),
});

export const createLabelSchema = z.object({
  name: z.string().min(1, 'Label name is required').max(50, 'Label name is too long'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code (e.g. #FF0000)'),
});

export const bulkMoveTasksSchema = z.object({
  taskIds: z.array(z.string().uuid('Invalid task ID')),
  status: z.nativeEnum(TaskStatus),
});

export const bulkDeleteTasksSchema = z.object({
  taskIds: z.array(z.string().uuid('Invalid task ID')),
});
