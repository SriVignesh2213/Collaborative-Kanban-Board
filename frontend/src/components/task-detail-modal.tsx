import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  User,
  Paperclip,
  Trash2,
  Send,
  Loader2,
  Tag,
  CircleDot,
  FileText,
  MessageSquare,
  Clock,
  Plus,
} from 'lucide-react';
import apiClient from '../lib/api-client.js';
import { useAuth } from '../contexts/auth-context.js';
import { useSocket } from '../contexts/socket-context.js';
import { useToast } from '../components/ui/toast.js';
import { Dialog, Button, Avatar, Input, Textarea } from '../components/ui/index.js';
import { Task, Label, Comment, Attachment, Activity, TaskStatus, Priority } from '../types/index.js';

interface TaskDetailModalProps {
  taskId: string;
  workspace: any;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ taskId, workspace, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { typingUsers, broadcastTypingStart, broadcastTypingStop, broadcastBoardChange } = useSocket();

  // State
  const [commentContent, setCommentContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local edit states for description/title blur updates
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Fetch full details of this task
  const { data: task, isLoading, error } = useQuery<Task & { comments: Comment[]; attachments: Attachment[]; activities: Activity[] }>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspace.id}/tasks/${taskId}`);
      return res.data;
    },
    enabled: !!taskId && !!workspace?.id,
  });

  // Sync details on fetch load
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  // Mutations
  const updateTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.patch(`/workspaces/${workspace.id}/tasks/${taskId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      broadcastBoardChange('UPDATE', taskId);
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to update task', 'error');
    },
  });

  const deleteDetailMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/workspaces/${workspace.id}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      toast('Task deleted successfully', 'success');
      broadcastBoardChange('DELETE');
      onClose();
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiClient.post(`/workspaces/${workspace.id}/tasks/${taskId}/comments`, { content });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      setCommentContent('');
      broadcastTypingStop(taskId);
      broadcastBoardChange('COMMENT', taskId);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/tasks/${taskId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      toast('Comment deleted', 'info');
      broadcastBoardChange('UPDATE', taskId);
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiClient.delete(`/workspaces/${workspace.id}/tasks/${taskId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      toast('Attachment deleted', 'info');
      broadcastBoardChange('UPDATE', taskId);
    },
  });

  // Blur saves
  const handleTitleBlur = () => {
    if (task && title.trim() && title !== task.title) {
      updateTaskMutation.mutate({ title });
    }
  };

  const handleDescBlur = () => {
    if (task && description !== (task.description || '')) {
      updateTaskMutation.mutate({ description });
    }
  };

  // Typing indicators logic
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommentContent(e.target.value);
    if (e.target.value.length > 0) {
      broadcastTypingStart(taskId);
    } else {
      broadcastTypingStop(taskId);
    }
  };

  const handleCommentBlur = () => {
    broadcastTypingStop(taskId);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    createCommentMutation.mutate(commentContent);
  };

  // Upload attachment file handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast('File is too large. Max size is 10MB', 'error');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await apiClient.post(`/workspaces/${workspace.id}/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspace.id] });
      toast('File uploaded successfully!', 'success');
      broadcastBoardChange('UPDATE', taskId);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to upload attachment', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Check which other collaborators are typing on this specific task
  const activeTypists = typingUsers[taskId] || [];

  if (error) {
    return (
      <Dialog isOpen={true} onClose={onClose} title="Error">
        <div className="text-center py-6 font-sans">
          <p className="text-rose-500 font-bold">Failed to load task details</p>
          <Button className="mt-4" onClick={onClose}>Close</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog isOpen={true} onClose={onClose} size="xl">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <span className="text-sm font-semibold text-muted-foreground font-sans">
            Loading task details...
          </span>
        </div>
      ) : (
        task && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-full max-h-[80vh] font-sans">
            
            {/* LEFT DETAILS WORKSPACE PANE (Col Span 3) */}
            <div className="lg:col-span-3 space-y-6 overflow-y-auto pr-2">
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="w-full text-2xl font-extrabold text-foreground bg-transparent border-0 focus:ring-0 p-0 focus:outline-none placeholder:text-muted-foreground focus:border-b focus:border-primary pb-1"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescBlur}
                  placeholder="Describe this task's scope..."
                  className="min-h-[140px] text-sm bg-background/30"
                />
              </div>

              {/* COMMENTS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                    <MessageSquare className="h-4.5 w-4.5" /> Comments
                  </div>
                  {activeTypists.length > 0 && (
                    <span className="text-[10px] text-primary font-medium animate-pulse">
                      {activeTypists.join(', ')} {activeTypists.length === 1 ? 'is' : 'are'} typing...
                    </span>
                  )}
                </div>

                <form onSubmit={handleCommentSubmit} className="flex gap-2 items-start">
                  <Avatar name={user?.name || ''} size="sm" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={commentContent}
                      onChange={handleCommentChange}
                      onBlur={handleCommentBlur}
                      placeholder="Add a collaborative comment..."
                      className="w-full min-h-[60px] max-h-[120px] rounded-lg border border-border bg-background/50 p-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="text-xs h-8 px-3"
                        disabled={!commentContent.trim() || createCommentMutation.isPending}
                      >
                        <Send className="h-3 w-3 mr-1" /> Comment
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 bg-secondary/10 border border-border/40 p-3 rounded-xl">
                      <Avatar name={comment.user.name} size="sm" />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-foreground">
                            {comment.user.name}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {comment.content}
                        </p>
                      </div>
                      {(comment.userId === user?.id || workspace.members.find((m: any) => m.userId === user?.id)?.role !== 'MEMBER') && (
                        <button
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          className="text-muted-foreground hover:text-rose-500 transition self-start"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {task.comments.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      No comments posted yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT METADATA PANEL (Col Span 2) */}
            <div className="lg:col-span-2 space-y-6 border-t lg:border-t-0 lg:border-l border-border pt-6 lg:pt-0 lg:pl-6 overflow-y-auto">
              
              {/* Core Details grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Status</span>
                  <select
                    value={task.status}
                    onChange={(e) => updateTaskMutation.mutate({ status: e.target.value as TaskStatus })}
                    className="text-xs font-bold bg-background/50 rounded-lg border border-border px-3 py-1.5 focus:outline-none"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Priority</span>
                  <select
                    value={task.priority}
                    onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value as Priority })}
                    className="text-xs font-bold bg-background/50 rounded-lg border border-border px-3 py-1.5 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Assignee
                  </span>
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) => updateTaskMutation.mutate({ assigneeId: e.target.value || null })}
                    className="text-xs font-bold bg-background/50 rounded-lg border border-border px-3 py-1.5 focus:outline-none max-w-[150px]"
                  >
                    <option value="">Unassigned</option>
                    {workspace.members.map((m: any) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Due Date
                  </span>
                  <input
                    type="date"
                    value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      updateTaskMutation.mutate({
                        dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="text-xs font-bold bg-background/50 rounded-lg border border-border px-3 py-1 focus:outline-none"
                  />
                </div>
              </div>

              {/* ATTACHMENTS SECTION */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1">
                    <Paperclip className="h-4 w-4 text-indigo-500" /> Attachments
                  </span>
                  <Button
                    variant="glass"
                    size="sm"
                    className="h-7 text-[10px] font-bold px-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3 w-3 mr-0.5" /> Add File
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {task.attachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between border border-border/60 bg-secondary/5 p-2 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline truncate"
                        >
                          {file.name}
                        </a>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => deleteAttachmentMutation.mutate(file.id)}
                        className="text-muted-foreground hover:text-rose-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {task.attachments.length === 0 && (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      No attachments uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIVITY HISTORY LOG TIMELINE */}
              <div className="space-y-3 border-t border-border pt-4">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-sky-500" /> History Timeline
                </span>

                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                  {task.activities.map((act) => {
                    let actMsg = 'performed an action';
                    if (act.actionType === 'TASK_CREATE') {
                      actMsg = 'created the task';
                    } else if (act.actionType === 'TASK_MOVE') {
                      const details = JSON.parse(act.details || '{}');
                      actMsg = `moved task from ${details.from} to ${details.to}`;
                    } else if (act.actionType === 'TASK_UPDATE') {
                      const details = JSON.parse(act.details || '{}');
                      actMsg = `updated ${details.changes?.join(', ')}`;
                    } else if (act.actionType === 'COMMENT_ADD') {
                      actMsg = 'added a comment';
                    } else if (act.actionType === 'ATTACHMENT_ADD') {
                      const details = JSON.parse(act.details || '{}');
                      actMsg = `attached file: ${details.name}`;
                    }

                    return (
                      <div key={act.id} className="flex gap-2 items-start text-[10px]">
                        <CircleDot className="h-2 w-2 text-primary shrink-0 mt-1" />
                        <div>
                          <p className="text-foreground font-semibold">
                            {act.user.name} <span className="text-muted-foreground font-medium">{actMsg}</span>
                          </p>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {new Date(act.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DANGER ACTIONS */}
              <div className="border-t border-border pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs font-bold"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this task permanently?')) {
                      deleteDetailMutation.mutate();
                    }
                  }}
                  disabled={deleteDetailMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Task Permanently
                </Button>
              </div>

            </div>

          </div>
        )
      )}
    </Dialog>
  );
};
export default TaskDetailModal;
