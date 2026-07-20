import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_for_development_12948712398';

interface ActiveUser {
  socketId: string;
  userId: string;
  name: string;
  email: string;
}

// Maps workspaceId -> Array of ActiveUser
const workspacePresence: { [workspaceId: string]: ActiveUser[] } = {};

export const initSockets = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  // Authentication Middleware for Sockets
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as { id: string; name: string; email: string };
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    // console.log(`[Socket] User connected: ${user.name} (${socket.id})`);

    // Join Workspace Room
    socket.on('join-workspace', ({ workspaceId }: { workspaceId: string }) => {
      socket.join(workspaceId);
      // console.log(`[Socket] User ${user.name} joined workspace: ${workspaceId}`);

      // Add to presence list
      if (!workspacePresence[workspaceId]) {
        workspacePresence[workspaceId] = [];
      }

      // Evict duplicate socket registrations for the user in this workspace
      workspacePresence[workspaceId] = workspacePresence[workspaceId].filter((u) => u.userId !== user.id);

      const activeUser: ActiveUser = {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        email: user.email,
      };

      workspacePresence[workspaceId].push(activeUser);

      // Broadcast active user list
      io.to(workspaceId).emit('workspace-presence-update', workspacePresence[workspaceId]);
    });

    // Leave Workspace Room
    socket.on('leave-workspace', ({ workspaceId }: { workspaceId: string }) => {
      socket.leave(workspaceId);
      // console.log(`[Socket] User ${user.name} left workspace: ${workspaceId}`);

      if (workspacePresence[workspaceId]) {
        workspacePresence[workspaceId] = workspacePresence[workspaceId].filter((u) => u.socketId !== socket.id);
        io.to(workspaceId).emit('workspace-presence-update', workspacePresence[workspaceId]);
      }
    });

    // Cursor Movement Shared Drawing (User cursor motion effects)
    socket.on('cursor-move', (data: { workspaceId: string; x: number; y: number; userName: string; color: string }) => {
      socket.to(data.workspaceId).emit('cursor-moved', {
        userId: user.id,
        userName: data.userName,
        x: data.x,
        y: data.y,
        color: data.color,
      });
    });

    // Live Typing Indicators
    socket.on('task-typing-start', (data: { workspaceId: string; taskId: string; userName: string }) => {
      socket.to(data.workspaceId).emit('task-typing-started', {
        taskId: data.taskId,
        userId: user.id,
        userName: data.userName,
      });
    });

    socket.on('task-typing-stop', (data: { workspaceId: string; taskId: string }) => {
      socket.to(data.workspaceId).emit('task-typing-stopped', {
        taskId: data.taskId,
        userId: user.id,
      });
    });

    // Kanban Drag and Drop Sync Broadcast
    socket.on('board-drag-update', (data: { workspaceId: string; taskId: string; status: string; position: number }) => {
      socket.to(data.workspaceId).emit('board-dragged', {
        taskId: data.taskId,
        status: data.status,
        position: data.position,
        userId: user.id,
      });
    });

    // Dynamic Board Events (creation, update, delete, comments)
    socket.on('board-change', (data: { workspaceId: string; taskId?: string; actionType: string }) => {
      socket.to(data.workspaceId).emit('board-changed', {
        taskId: data.taskId,
        actionType: data.actionType, // 'CREATE', 'UPDATE', 'DELETE', 'COMMENT'
        userId: user.id,
      });
    });

    socket.on('disconnecting', () => {
      // Remove user from all workspace presences they joined
      const rooms = Array.from(socket.rooms);
      rooms.forEach((room) => {
        if (workspacePresence[room]) {
          workspacePresence[room] = workspacePresence[room].filter((u) => u.socketId !== socket.id);
          io.to(room).emit('workspace-presence-update', workspacePresence[room]);
        }
      });
    });

    socket.on('disconnect', () => {
      // console.log(`[Socket] User disconnected: ${user.name}`);
    });
  });

  return io;
};
