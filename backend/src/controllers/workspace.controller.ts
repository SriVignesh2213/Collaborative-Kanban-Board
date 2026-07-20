import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { WorkspaceRequest } from '../middleware/role';
import { createWorkspaceSchema, renameWorkspaceSchema, updateMemberRoleSchema } from '../validators/workspace.validator';
import { AppError } from '../middleware/error';
import { Role } from '@prisma/client';

const generateInviteCode = (): string => {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char unique code
};

export const createWorkspace = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = createWorkspaceSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    let inviteCode = generateInviteCode();
    // Ensure uniqueness
    while (await prisma.workspace.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: validatedData.name,
        inviteCode,
        members: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Create some default labels for the workspace
    await prisma.label.createMany({
      data: [
        { name: 'Bug', color: '#EF4444', workspaceId: workspace.id },
        { name: 'Feature', color: '#3B82F6', workspaceId: workspace.id },
        { name: 'Documentation', color: '#10B981', workspaceId: workspace.id },
        { name: 'Refactor', color: '#F59E0B', workspaceId: workspace.id },
      ],
    });

    res.status(201).json(workspace);
  } catch (error) {
    next(error);
  }
};

export const getWorkspaces = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(workspaces);
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceDetails = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        labels: true,
      },
    });

    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};

export const renameWorkspace = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const validatedData = renameWorkspaceSchema.parse(req.body);

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: validatedData.name },
    });

    res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};

export const deleteWorkspace = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    // Double check: Only Owner can delete
    if (req.workspaceMember?.role !== Role.OWNER) {
      throw new AppError('Only the workspace owner can delete a workspace', 403);
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    res.status(200).json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const joinWorkspace = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user?.id;

    if (!inviteCode) {
      throw new AppError('Invite code is required', 400);
    }

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { inviteCode },
    });

    if (!workspace) {
      throw new AppError('Invalid invite code', 404);
    }

    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new AppError('You are already a member of this workspace', 409);
    }

    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: Role.MEMBER,
      },
      include: {
        workspace: true,
      },
    });

    // Log Join Activity
    await prisma.activity.create({
      data: {
        workspaceId: workspace.id,
        userId,
        actionType: 'MEMBER_JOIN',
      },
    });

    res.status(200).json({
      message: 'Joined workspace successfully',
      workspace: newMember.workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const leaveWorkspace = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Owner cannot leave unless they transfer ownership first
    if (req.workspaceMember?.role === Role.OWNER) {
      throw new AppError('The owner cannot leave. Please transfer ownership or delete the workspace.', 400);
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    res.status(200).json({ message: 'Left workspace successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateMemberRole = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { userId, role } = updateMemberRoleSchema.parse(req.body);

    // Only OWNER can modify roles. Only OWNER can promote other to OWNER.
    if (req.workspaceMember?.role !== Role.OWNER) {
      throw new AppError('Only the owner can manage workspace member roles', 403);
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!targetMember) {
      throw new AppError('Member not found in workspace', 404);
    }

    if (role === Role.OWNER) {
      // Step 1: Promote target user to OWNER, demote current owner (req.user.id) to ADMIN
      await prisma.$transaction([
        prisma.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId, userId } },
          data: { role: Role.OWNER },
        }),
        prisma.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId, userId: req.user!.id } },
          data: { role: Role.ADMIN },
        }),
      ]);
    } else {
      await prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { role },
      });
    }

    res.status(200).json({ message: 'Member role updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const regenerateInviteCode = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    if (req.workspaceMember?.role !== Role.OWNER && req.workspaceMember?.role !== Role.ADMIN) {
      throw new AppError('Insufficient permissions to reset invite code', 403);
    }

    let inviteCode = generateInviteCode();
    while (await prisma.workspace.findUnique({ where: { inviteCode } })) {
      inviteCode = generateInviteCode();
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { inviteCode },
    });

    res.status(200).json({ inviteCode: workspace.inviteCode });
  } catch (error) {
    next(error);
  }
};
