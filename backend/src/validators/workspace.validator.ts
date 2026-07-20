import { z } from 'zod';
import { Role } from '@prisma/client';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Workspace name is too long'),
});

export const renameWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Workspace name is too long'),
});

export const joinWorkspaceSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export const updateMemberRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.nativeEnum(Role),
});
