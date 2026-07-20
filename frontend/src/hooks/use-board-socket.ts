import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../contexts/socket-context.js';
import { Task } from '../types/index.js';

export const useBoardSocket = (workspaceId: string | null) => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !workspaceId) return;

    // Listen for remote drag events
    socket.on(
      'board-dragged',
      ({ taskId, status, position, userId }) => {
        // Optimistically update tasks cache
        queryClient.setQueryData(
          ['tasks', workspaceId],
          (oldData: any) => {
            if (!oldData || !oldData.tasks) return oldData;
            
            const updatedTasks = oldData.tasks.map((task: Task) => {
              if (task.id === taskId) {
                return { ...task, status, position };
              }
              return task;
            });

            // Re-sort elements by their position
            updatedTasks.sort((a: Task, b: Task) => a.position - b.position);

            return {
              ...oldData,
              tasks: updatedTasks,
            };
          }
        );
      }
    );

    // Listen for general creations, updates, deletions, and comments
    socket.on('board-changed', ({ taskId, actionType, userId }) => {
      // Invalidate tasks query to trigger background synchronizations
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });

      if (taskId) {
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      }

      // Also invalidate workspace activities log if active
      queryClient.invalidateQueries({ queryKey: ['activities', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
    });

    return () => {
      socket.off('board-dragged');
      socket.off('board-changed');
    };
  }, [socket, workspaceId, queryClient]);
};
