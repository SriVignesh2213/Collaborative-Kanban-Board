import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { WorkspaceRequest } from '../middleware/role';
import { createCommentSchema } from '../validators/task.validator';
import { AppError } from '../middleware/error';

export const createComment = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const { content } = createCommentSchema.parse(req.body);

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: task.workspaceId,
        taskId,
        userId,
        actionType: 'COMMENT_ADD',
        details: JSON.stringify({ commentId: comment.id }),
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    // Only creator of comment or workspace owner/admin can delete comment
    if (comment.userId !== userId && req.workspaceMember?.role === 'MEMBER') {
      throw new AppError('You do not have permission to delete this comment', 403);
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.status(200).json({ message: 'Comment deleted successfully', commentId });
  } catch (error) {
    next(error);
  }
};
