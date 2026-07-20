import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context.js';

interface CollaboratorCursor {
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
}

interface OnlineUser {
  userId: string;
  name: string;
  email: string;
}

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: OnlineUser[];
  cursors: { [userId: string]: CollaboratorCursor };
  typingUsers: { [taskId: string]: string[] }; // taskId -> array of names
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  broadcastCursorMove: (x: number, y: number) => void;
  broadcastTypingStart: (taskId: string) => void;
  broadcastTypingStop: (taskId: string) => void;
  broadcastBoardDrag: (taskId: string, status: string, position: number) => void;
  broadcastBoardChange: (actionType: string, taskId?: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [cursors, setCursors] = useState<{ [userId: string]: CollaboratorCursor }>({});
  const [typingUsers, setTypingUsers] = useState<{ [taskId: string]: string[] }>({});

  const cursorColorRef = useRef<string>(
    `hsl(${Math.floor(Math.random() * 360)}, 85%, 55%)`
  );

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setOnlineUsers([]);
      setCursors({});
      setTypingUsers({});
      return;
    }

    const token = localStorage.getItem('accessToken');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Handle Workspace room join/leave
  useEffect(() => {
    if (!socket || !activeWorkspaceId) {
      setOnlineUsers([]);
      setCursors({});
      setTypingUsers({});
      return;
    }

    socket.emit('join-workspace', { workspaceId: activeWorkspaceId });

    socket.on('workspace-presence-update', (users: OnlineUser[]) => {
      setOnlineUsers(users.filter((u) => u.userId !== user?.id)); // Show other users
    });

    socket.on('cursor-moved', (cursor: CollaboratorCursor) => {
      setCursors((prev) => ({
        ...prev,
        [cursor.userId]: cursor,
      }));
    });

    socket.on('task-typing-started', ({ taskId, userName, userId }) => {
      setTypingUsers((prev) => {
        const list = prev[taskId] || [];
        if (list.includes(userName)) return prev;
        return { ...prev, [taskId]: [...list, userName] };
      });
    });

    socket.on('task-typing-stopped', ({ taskId, userName, userId }) => {
      setTypingUsers((prev) => {
        const list = prev[taskId] || [];
        // Extract from typing list
        const filtered = list.filter((name) => name !== userName);
        return { ...prev, [taskId]: filtered };
      });
    });

    // Cleanup listeners when switching workspaces
    return () => {
      socket.emit('leave-workspace', { workspaceId: activeWorkspaceId });
      socket.off('workspace-presence-update');
      socket.off('cursor-moved');
      socket.off('task-typing-started');
      socket.off('task-typing-stopped');
    };
  }, [socket, activeWorkspaceId, user]);

  const broadcastCursorMove = (x: number, y: number) => {
    if (!socket || !activeWorkspaceId || !user) return;
    socket.emit('cursor-move', {
      workspaceId: activeWorkspaceId,
      x,
      y,
      userName: user.name,
      color: cursorColorRef.current,
    });
  };

  const broadcastTypingStart = (taskId: string) => {
    if (!socket || !activeWorkspaceId || !user) return;
    socket.emit('task-typing-start', {
      workspaceId: activeWorkspaceId,
      taskId,
      userName: user.name,
    });
  };

  const broadcastTypingStop = (taskId: string) => {
    if (!socket || !activeWorkspaceId) return;
    socket.emit('task-typing-stop', {
      workspaceId: activeWorkspaceId,
      taskId,
    });
  };

  const broadcastBoardDrag = (taskId: string, status: string, position: number) => {
    if (!socket || !activeWorkspaceId) return;
    socket.emit('board-drag-update', {
      workspaceId: activeWorkspaceId,
      taskId,
      status,
      position,
    });
  };

  const broadcastBoardChange = (actionType: string, taskId?: string) => {
    if (!socket || !activeWorkspaceId) return;
    socket.emit('board-change', {
      workspaceId: activeWorkspaceId,
      taskId,
      actionType,
    });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
        cursors,
        typingUsers,
        activeWorkspaceId,
        setActiveWorkspaceId,
        broadcastCursorMove,
        broadcastTypingStart,
        broadcastTypingStop,
        broadcastBoardDrag,
        broadcastBoardChange,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
export default SocketContext;
export { SocketContext };
