import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth';
import { requireWorkspaceMember } from '../middleware/role';
import { Role } from '@prisma/client';

import {
  register,
  login,
  logout,
  refresh,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';

import {
  createWorkspace,
  getWorkspaces,
  getWorkspaceDetails,
  renameWorkspace,
  deleteWorkspace,
  joinWorkspace,
  leaveWorkspace,
  updateMemberRole,
  regenerateInviteCode,
} from '../controllers/workspace.controller';

import {
  createTask,
  getTasks,
  getTaskDetails,
  updateTask,
  moveTask,
  deleteTask,
  bulkMoveTasks,
  bulkDeleteTasks,
  createLabel,
  getLabels,
  getWorkspaceActivities,
} from '../controllers/task.controller';

import { createComment, deleteComment } from '../controllers/comment.controller';
import { uploadAttachment, deleteAttachment } from '../controllers/attachment.controller';
import { getDashboardStats } from '../controllers/dashboard.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.post('/auth/refresh', refresh);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);

// ==========================================
// WORKSPACE ROUTES (Protected)
// ==========================================
router.use('/workspaces', authenticateToken);
router.post('/workspaces', createWorkspace);
router.get('/workspaces', getWorkspaces);
router.post('/workspaces/join', joinWorkspace);

router.get('/workspaces/:workspaceId', requireWorkspaceMember(), getWorkspaceDetails);
router.patch('/workspaces/:workspaceId', requireWorkspaceMember([Role.OWNER, Role.ADMIN]), renameWorkspace);
router.delete('/workspaces/:workspaceId', requireWorkspaceMember([Role.OWNER]), deleteWorkspace);
router.post('/workspaces/:workspaceId/leave', requireWorkspaceMember(), leaveWorkspace);
router.patch('/workspaces/:workspaceId/role', requireWorkspaceMember([Role.OWNER]), updateMemberRole);
router.post('/workspaces/:workspaceId/invite-code', requireWorkspaceMember([Role.OWNER, Role.ADMIN]), regenerateInviteCode);

// ==========================================
// TASK & KANBAN BOARD ROUTES (Protected)
// ==========================================
router.post('/workspaces/:workspaceId/tasks', requireWorkspaceMember(), createTask);
router.get('/workspaces/:workspaceId/tasks', requireWorkspaceMember(), getTasks);
router.post('/workspaces/:workspaceId/tasks/bulk-move', requireWorkspaceMember(), bulkMoveTasks);
router.post('/workspaces/:workspaceId/tasks/bulk-delete', requireWorkspaceMember(), bulkDeleteTasks);
router.get('/workspaces/:workspaceId/activities', requireWorkspaceMember(), getWorkspaceActivities);
router.post('/workspaces/:workspaceId/labels', requireWorkspaceMember(), createLabel);
router.get('/workspaces/:workspaceId/labels', requireWorkspaceMember(), getLabels);

router.get('/workspaces/:workspaceId/tasks/:taskId', requireWorkspaceMember(), getTaskDetails);
router.patch('/workspaces/:workspaceId/tasks/:taskId', requireWorkspaceMember(), updateTask);
router.patch('/workspaces/:workspaceId/tasks/:taskId/move', requireWorkspaceMember(), moveTask);
router.delete('/workspaces/:workspaceId/tasks/:taskId', requireWorkspaceMember(), deleteTask);

// ==========================================
// COMMENT ROUTES (Protected)
// ==========================================
router.post('/workspaces/:workspaceId/tasks/:taskId/comments', requireWorkspaceMember(), createComment);
router.delete('/workspaces/:workspaceId/tasks/:taskId/comments/:commentId', requireWorkspaceMember(), deleteComment);

// ==========================================
// ATTACHMENT ROUTES (Protected)
// ==========================================
router.post(
  '/workspaces/:workspaceId/tasks/:taskId/attachments',
  requireWorkspaceMember(),
  upload.single('file'),
  uploadAttachment
);
router.delete(
  '/workspaces/:workspaceId/tasks/:taskId/attachments/:attachmentId',
  requireWorkspaceMember(),
  deleteAttachment
);

// ==========================================
// DASHBOARD ANALYTICS (Protected)
// ==========================================
router.get('/workspaces/:workspaceId/dashboard', requireWorkspaceMember(), getDashboardStats);

export default router;
