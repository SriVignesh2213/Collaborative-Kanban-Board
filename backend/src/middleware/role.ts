import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from './auth';
import { Role } from '@prisma/client';

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspaceMember?: {
    id: string;
    role: Role;
  };
}

export const requireWorkspaceMember = (allowedRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]) => {
  return async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workspaceId } = req.params;
      const userId = req.user?.id;

      if (!workspaceId) {
        res.status(400).json({ error: 'Workspace ID parameter is required' });
        return;
      }

      if (!userId) {
        res.status(401).json({ error: 'User is not authenticated' });
        return;
      }

      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      if (!member) {
        res.status(403).json({ error: 'You are not a member of this workspace' });
        return;
      }

      if (!allowedRoles.includes(member.role)) {
        res.status(403).json({ error: 'Insufficient permissions for this workspace operation' });
        return;
      }

      req.workspaceMember = {
        id: member.id,
        role: member.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
