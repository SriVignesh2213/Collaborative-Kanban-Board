export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: Role;
  user: User;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  publicId: string;
  size: number;
  mimeType: string;
  taskId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  user: User;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  taskId?: string;
  task?: { id: string; title: string };
  userId: string;
  user: User;
  actionType: string;
  details?: string; // JSON string
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  position: number;
  dueDate?: string;
  isArchived: boolean;
  workspaceId: string;
  creatorId: string;
  creator: User;
  assigneeId?: string;
  assignee?: User;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: WorkspaceMember[];
  labels: Label[];
}
