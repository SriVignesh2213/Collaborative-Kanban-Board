import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { WorkspaceRequest } from '../middleware/role';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { AppError } from '../middleware/error';

export const uploadAttachment = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const file = req.file;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    if (!file) {
      throw new AppError('File upload is required', 400);
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Upload to Cloudinary (or mock fallback if credentials not present)
    const uploadResult = await uploadToCloudinary(file.buffer, file.originalname, `kanban/task_${taskId}`);

    const attachment = await prisma.attachment.create({
      data: {
        name: file.originalname,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        size: file.size,
        mimeType: file.mimetype,
        taskId,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: task.workspaceId,
        taskId,
        userId,
        actionType: 'ATTACHMENT_ADD',
        details: JSON.stringify({ name: file.originalname, attachmentId: attachment.id }),
      },
    });

    res.status(201).json(attachment);
  } catch (error) {
    next(error);
  }
};

export const deleteAttachment = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { task: true },
    });

    if (!attachment) {
      throw new AppError('Attachment not found', 404);
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(attachment.publicId);

    // Delete from Database
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId: attachment.task.workspaceId,
        taskId: attachment.taskId,
        userId,
        actionType: 'ATTACHMENT_DELETE',
        details: JSON.stringify({ name: attachment.name }),
      },
    });

    res.status(200).json({ message: 'Attachment deleted successfully', attachmentId });
  } catch (error) {
    next(error);
  }
};
