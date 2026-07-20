import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { WorkspaceRequest } from '../middleware/role';
import { createTaskSchema, updateTaskSchema, moveTaskSchema, createLabelSchema, bulkMoveTasksSchema, bulkDeleteTasksSchema } from '../validators/task.validator';
import { AppError } from '../middleware/error';
import { Priority, TaskStatus } from '@prisma/client';

export const createTask = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?.id;
    const validatedData = createTaskSchema.parse(req.body);

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    // Determine position for new task (max position + 1000 in this status, or 1000 if first)
    const lastTask = await prisma.task.findFirst({
      where: { workspaceId, status: validatedData.status, isArchived: false },
      orderBy: { position: 'desc' },
    });

    const position = lastTask ? lastTask.position + 1000 : 1000;

    const task = await prisma.task.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        priority: validatedData.priority,
        status: validatedData.status,
        position,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        workspaceId,
        creatorId: userId,
        assigneeId: validatedData.assigneeId || null,
        labels: validatedData.labelIds
          ? { connect: validatedData.labelIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId,
        taskId: task.id,
        userId,
        actionType: 'TASK_CREATE',
        details: JSON.stringify({ title: task.title }),
      },
    });

    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
};

export const getTasks = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const {
      status,
      priority,
      assigneeId,
      search,
      isArchived = 'false',
      page = '1',
      limit = '100',
      sortBy = 'position',
      sortOrder = 'asc',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Filter construction
    const whereClause: any = {
      workspaceId,
      isArchived: isArchived === 'true',
    };

    if (status) {
      whereClause.status = status as TaskStatus;
    }
    if (priority) {
      whereClause.priority = priority as Priority;
    }
    if (assigneeId) {
      whereClause.assigneeId = assigneeId === 'null' ? null : (assigneeId as string);
    }
    if (search) {
      whereClause.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: true,
        _count: {
          select: { comments: true, attachments: true },
        },
      },
      orderBy: { [sortBy as string]: sortOrder as 'asc' | 'desc' },
      skip: offset,
      take: limitNum,
    });

    const totalCount = await prisma.task.count({ where: whereClause });

    res.status(200).json({
      tasks,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskDetails = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: true,
        attachments: true,
        comments: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const validatedData = updateTaskSchema.parse(req.body);

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!currentTask) {
      throw new AppError('Task not found', 404);
    }

    // Prepare update payload
    const updateData: any = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }
    if (validatedData.assigneeId !== undefined) {
      updateData.assigneeId = validatedData.assigneeId;
    }
    if (validatedData.isArchived !== undefined) {
      updateData.isArchived = validatedData.isArchived;
    }

    // Handle labels separately if they are provided
    if (validatedData.labelIds !== undefined) {
      updateData.labels = {
        set: validatedData.labelIds.map((id) => ({ id })),
      };
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: true,
      },
    });

    // Create activity logs for audit timeline
    const changes: string[] = [];
    if (validatedData.status && validatedData.status !== currentTask.status) {
      changes.push(`status to ${validatedData.status}`);
    }
    if (validatedData.priority && validatedData.priority !== currentTask.priority) {
      changes.push(`priority to ${validatedData.priority}`);
    }
    if (validatedData.assigneeId !== undefined && validatedData.assigneeId !== currentTask.assigneeId) {
      changes.push(`assignee`);
    }

    if (changes.length > 0) {
      await prisma.activity.create({
        data: {
          workspaceId: currentTask.workspaceId,
          taskId: currentTask.id,
          userId,
          actionType: 'TASK_UPDATE',
          details: JSON.stringify({ changes }),
        },
      });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

export const moveTask = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const { status, position } = moveTaskSchema.parse(req.body);

    if (!userId) {
      throw new AppError('Authentication required', 401);
    }

    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!currentTask) {
      throw new AppError('Task not found', 404);
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status, position },
      include: {
        creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        labels: true,
      },
    });

    if (status !== currentTask.status) {
      await prisma.activity.create({
        data: {
          workspaceId: currentTask.workspaceId,
          taskId: currentTask.id,
          userId,
          actionType: 'TASK_MOVE',
          details: JSON.stringify({ from: currentTask.status, to: status }),
        },
      });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    res.status(200).json({ message: 'Task deleted successfully', taskId });
  } catch (error) {
    next(error);
  }
};

export const bulkMoveTasks = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { taskIds, status } = bulkMoveTasksSchema.parse(req.body);

    // Fetch max position in destination column
    const lastTask = await prisma.task.findFirst({
      where: { workspaceId, status, isArchived: false },
      orderBy: { position: 'desc' },
    });

    let currentPos = lastTask ? lastTask.position : 1000;

    const transactions = taskIds.map((id) => {
      currentPos += 1000;
      return prisma.task.update({
        where: { id, workspaceId },
        data: { status, position: currentPos },
      });
    });

    await prisma.$transaction(transactions);

    res.status(200).json({ message: 'Tasks moved successfully', taskIds, status });
  } catch (error) {
    next(error);
  }
};

export const bulkDeleteTasks = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { taskIds } = bulkDeleteTasksSchema.parse(req.body);

    await prisma.task.deleteMany({
      where: {
        id: { in: taskIds },
        workspaceId,
      },
    });

    res.status(200).json({ message: 'Tasks deleted successfully', taskIds });
  } catch (error) {
    next(error);
  }
};

// Label Operations
export const createLabel = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;
    const { name, color } = createLabelSchema.parse(req.body);

    const label = await prisma.label.create({
      data: {
        name,
        color,
        workspaceId,
      },
    });

    res.status(201).json(label);
  } catch (error) {
    next(error);
  }
};

export const getLabels = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const labels = await prisma.label.findMany({
      where: { workspaceId },
    });

    res.status(200).json(labels);
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceActivities = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const activities = await prisma.activity.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json(activities);
  } catch (error) {
    next(error);
  }
};
