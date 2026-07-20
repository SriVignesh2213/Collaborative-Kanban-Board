import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { WorkspaceRequest } from '../middleware/role';
import { TaskStatus, Priority } from '@prisma/client';

export const getDashboardStats = async (req: WorkspaceRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    // Fetch all active (non-archived) tasks in workspace
    const tasks = await prisma.task.findMany({
      where: { workspaceId, isArchived: false },
      include: {
        assignee: { select: { id: true, name: true } },
      },
    });

    const now = new Date();

    // 1. Core aggregates
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const pendingTasks = tasks.filter((t) => t.status === TaskStatus.TODO || t.status === TaskStatus.IN_PROGRESS).length;
    const reviewTasks = tasks.filter((t) => t.status === TaskStatus.REVIEW).length;

    const overdueTasks = tasks.filter((t) => {
      return t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE;
    }).length;

    // 2. Status distribution
    const statusDistribution = {
      todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      review: tasks.filter((t) => t.status === TaskStatus.REVIEW).length,
      done: completedTasks,
    };

    // 3. Priority distribution
    const priorityDistribution = {
      low: tasks.filter((t) => t.priority === Priority.LOW).length,
      medium: tasks.filter((t) => t.priority === Priority.MEDIUM).length,
      high: tasks.filter((t) => t.priority === Priority.HIGH).length,
      critical: tasks.filter((t) => t.priority === Priority.CRITICAL).length,
    };

    // 4. Tasks per User
    const tasksPerUserMap: { [key: string]: number } = {};
    tasks.forEach((t) => {
      const name = t.assignee?.name || 'Unassigned';
      tasksPerUserMap[name] = (tasksPerUserMap[name] || 0) + 1;
    });
    const tasksPerUser = Object.entries(tasksPerUserMap).map(([name, count]) => ({
      name,
      value: count,
    }));

    // 5. Weekly Task Creation Trends (last 4 weeks)
    const weeklyTrends = [];
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * oneWeekMs);
      const end = new Date(now.getTime() - i * oneWeekMs);

      const createdCount = tasks.filter((t) => t.createdAt >= start && t.createdAt < end).length;
      const completedCount = tasks.filter((t) => t.status === TaskStatus.DONE && t.updatedAt >= start && t.updatedAt < end).length;

      weeklyTrends.push({
        week: `Wk -${i}`,
        created: createdCount,
        completed: completedCount,
      });
    }

    // 6. Burndown chart data over last 10 days
    // A standard burndown displays total tasks remaining over time versus ideal burndown
    const burndownData = [];
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(now.getDate() - 10);

    for (let i = 0; i <= 10; i++) {
      const currentDate = new Date(tenDaysAgo);
      currentDate.setDate(tenDaysAgo.getDate() + i);
      currentDate.setHours(23, 59, 59, 999);

      // Remaining non-DONE tasks at this point in time
      const remainingTasks = tasks.filter((t) => {
        // If created after this day, it shouldn't be counted at all yet
        if (t.createdAt > currentDate) return false;
        // If it was completed/marked DONE after this day, it was still remaining
        const isDoneAtThisDate = t.status === TaskStatus.DONE && t.updatedAt <= currentDate;
        return !isDoneAtThisDate;
      }).length;

      burndownData.push({
        date: currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        remaining: remainingTasks,
        ideal: Math.round(totalTasks - (i * (totalTasks / 10))), // Linear reduction
      });
    }

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      summary: {
        totalTasks,
        completedTasks,
        pendingTasks,
        reviewTasks,
        overdueTasks,
        completionPercentage,
      },
      statusDistribution,
      priorityDistribution,
      tasksPerUser,
      weeklyTrends,
      burndownData,
    });
  } catch (error) {
    next(error);
  }
};
