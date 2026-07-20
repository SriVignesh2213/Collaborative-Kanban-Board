import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  MessageSquare,
  Paperclip,
  Calendar,
  AlertCircle,
  Archive,
  Search,
  Filter,
  CheckCircle,
  Trash,
  MoveRight,
} from 'lucide-react';
import apiClient from '../lib/api-client.js';
import { useToast } from '../components/ui/toast.js';
import { useSocket } from '../contexts/socket-context.js';
import { useBoardSocket } from '../hooks/use-board-socket.js';
import { Button, Input, Textarea, Dialog, Avatar } from '../components/ui/index.js';
import { Task, TaskStatus, Priority, Label, User } from '../types/index.js';
import { TaskDetailModal } from '../components/task-detail-modal.js';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'TODO', title: 'To Do', color: 'border-t-indigo-500 bg-indigo-500/5' },
  { id: 'IN_PROGRESS', title: 'In Progress', color: 'border-t-sky-500 bg-sky-500/5' },
  { id: 'REVIEW', title: 'Review', color: 'border-t-amber-500 bg-amber-500/5' },
  { id: 'DONE', title: 'Done', color: 'border-t-emerald-500 bg-emerald-500/5' },
];

const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).default('TODO'),
  assigneeId: z.string().optional().nullable(),
  labelIds: z.array(z.string()).optional(),
  dueDate: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  }, { message: 'Due date cannot be in the past' }),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { broadcastBoardDrag, broadcastBoardChange } = useSocket();

  // Load Real-time listeners for this workspace
  useBoardSocket(workspaceId || null);

  // Check for create task navigation intent
  useEffect(() => {
    if (location.state?.openCreateTask) {
      // Clear the state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
      setSelectedTaskStatus('TODO');
      setIsCreateOpen(true);
    }
  }, [location.state]);

  // States
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskStatus, setSelectedTaskStatus] = useState<TaskStatus>('TODO');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Bulk operation states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkMoveStatus, setBulkMoveStatus] = useState<TaskStatus>('TODO');

  const activeDetailTaskId = searchParams.get('taskId');

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Forms
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      priority: 'MEDIUM',
      status: 'TODO',
    },
  });

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspaceId}`);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const { data: tasksData, isLoading } = useQuery<{ tasks: Task[] }>({
    queryKey: ['tasks', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspaceId}/tasks`);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  const tasks = tasksData?.tasks || [];

  // Filtering
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      (task.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
    const matchesAssignee =
      assigneeFilter === 'ALL' ||
      (assigneeFilter === 'UNASSIGNED' && !task.assigneeId) ||
      task.assigneeId === assigneeFilter;
    return matchesSearch && matchesPriority && matchesAssignee;
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateTaskForm) => {
      const payload = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
      };
      const res = await apiClient.post(`/workspaces/${workspaceId}/tasks`, payload);
      return res.data;
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      setIsCreateOpen(false);
      reset();
      toast('Task created successfully!', 'success');
      broadcastBoardChange('CREATE', newTask.id);
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to create task', 'error');
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, position }: { taskId: string; status: TaskStatus; position: number }) => {
      const res = await apiClient.patch(`/workspaces/${workspaceId}/tasks/${taskId}/move`, {
        status,
        position,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to reorder task', 'error');
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async (status: TaskStatus) => {
      const res = await apiClient.post(`/workspaces/${workspaceId}/tasks/bulk-move`, {
        taskIds: selectedTaskIds,
        status,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      setSelectedTaskIds([]);
      setBulkActionOpen(false);
      toast('Tasks moved successfully', 'success');
      broadcastBoardChange('UPDATE');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Bulk move failed', 'error');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/workspaces/${workspaceId}/tasks/bulk-delete`, {
        taskIds: selectedTaskIds,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
      setSelectedTaskIds([]);
      setBulkActionOpen(false);
      toast('Tasks deleted successfully', 'success');
      broadcastBoardChange('DELETE');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Bulk delete failed', 'error');
    },
  });

  const onSubmit = (data: CreateTaskForm) => {
    createTaskMutation.mutate({ ...data, status: selectedTaskStatus });
  };

  // DRAG AND DROP HANDLERS
  const handleDragStart = (e: DragStartEvent) => {
    const { active } = e;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Check if dropping over a column container direct or a task node
    let targetStatus: TaskStatus = draggedTask.status;
    let targetPosition = draggedTask.position;

    const isOverColumn = COLUMNS.some((col) => col.id === overId);

    if (isOverColumn) {
      targetStatus = overId as TaskStatus;
      const columnTasks = tasks.filter((t) => t.status === targetStatus && t.id !== taskId);

      if (columnTasks.length === 0) {
        targetPosition = 1000;
      } else {
        // Drop at the bottom of column
        targetPosition = columnTasks[columnTasks.length - 1].position + 1000;
      }
    } else {
      // Dropping over another task card
      const targetTask = tasks.find((t) => t.id === overId);
      if (!targetTask) return;

      targetStatus = targetTask.status;
      const columnTasks = tasks.filter((t) => t.status === targetStatus && t.id !== taskId);
      
      const targetIndex = columnTasks.findIndex((t) => t.id === overId);

      if (targetIndex === 0) {
        // Drop at top
        targetPosition = columnTasks[0].position / 2;
      } else if (targetIndex === columnTasks.length - 1) {
        // Drop at bottom
        targetPosition = columnTasks[columnTasks.length - 1].position + 1000;
      } else {
        // Drop in-between
        const taskBefore = columnTasks[targetIndex - 1];
        const taskAfter = columnTasks[targetIndex];
        targetPosition = (taskBefore.position + taskAfter.position) / 2;
      }
    }

    // Apply client-side optimistic sorting update
    queryClient.setQueryData(['tasks', workspaceId], (old: any) => {
      if (!old) return old;
      const nextTasks = old.tasks.map((t: Task) => {
        if (t.id === taskId) return { ...t, status: targetStatus, position: targetPosition };
        return t;
      });
      nextTasks.sort((a: Task, b: Task) => a.position - b.position);
      return { ...old, tasks: nextTasks };
    });

    // Notify socket rooms for instant updates
    broadcastBoardDrag(taskId, targetStatus, targetPosition);
    // Send patch API request
    moveTaskMutation.mutate({ taskId, status: targetStatus, position: targetPosition });
  };

  const toggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details modal
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  // Dynamic board skeletons
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-secondary rounded-lg shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[70vh]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-xl p-4 space-y-4">
              <div className="h-6 w-32 bg-secondary rounded shimmer" />
              <div className="h-24 bg-secondary/60 rounded-xl shimmer" />
              <div className="h-32 bg-secondary/60 rounded-xl shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {/* HEADER CONTROLS WITH FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans text-foreground">
            {workspace?.name || 'Kanban Board'}
          </h1>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            Drag cards, filters tasks, and collaborate instantly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 w-full text-xs font-semibold bg-background/50 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-background/50 rounded-lg border border-border focus:outline-none"
          >
            <option value="ALL">Priority: All</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-background/50 rounded-lg border border-border focus:outline-none max-w-[140px]"
          >
            <option value="ALL">Assignee: All</option>
            <option value="UNASSIGNED">Unassigned</option>
            {workspace?.members.map((m: any) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </select>

          {selectedTaskIds.length > 0 && (
            <Button
              variant="glass"
              size="sm"
              onClick={() => setBulkActionOpen(true)}
              className="text-xs h-9 border-rose-500/20 text-rose-500"
            >
              Bulk Operations ({selectedTaskIds.length})
            </Button>
          )}

          <Button
            id="btn-new-task"
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedTaskStatus('TODO');
              setIsCreateOpen(true);
            }}
            className="text-xs font-bold"
          >
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        </div>
      </div>

      {/* KANBAN BOARD COLUMNS WRAPPER */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 overflow-x-auto min-h-[60vh] pb-10">
          {COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="flex flex-col w-full min-w-[250px] bg-secondary/20 rounded-2xl border border-border overflow-hidden"
              >
                {/* Column header */}
                <div className={`p-4 border-b border-border flex items-center justify-between border-t-2 ${col.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-tight text-foreground font-sans">
                      {col.title}
                    </span>
                    <span className="bg-secondary text-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTaskStatus(col.id);
                      setIsCreateOpen(true);
                    }}
                    className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Column body - drop container */}
                <SortableContext
                  items={columnTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <TaskDropContainer id={col.id} tasks={columnTasks}>
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isSelected={selectedTaskIds.includes(task.id)}
                        onSelect={(e) => toggleSelectTask(task.id, e)}
                        onClick={() => setSearchParams({ taskId: task.id })}
                      />
                    ))}

                    {columnTasks.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground font-sans border-2 border-dashed border-border/60 rounded-xl my-4 mx-2">
                        Drop items here
                      </div>
                    )}
                  </TaskDropContainer>
                </SortableContext>
              </div>
            );
          })}
        </div>

        {/* Drag Overlay node structure */}
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-90 scale-[1.03] rotate-1 shadow-2xl pointer-events-none">
              <TaskCard task={activeTask} isSelected={false} onSelect={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* DETAIL MODAL PANEL */}
      {activeDetailTaskId && (
        <TaskDetailModal
          taskId={activeDetailTaskId}
          workspace={workspace}
          onClose={() => {
            searchParams.delete('taskId');
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* CREATE TASK DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Task">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-sans">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Task Title
            </label>
            <Input placeholder="What needs to be done?" {...register('title')} />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </label>
            <Textarea placeholder="Add some descriptive context..." {...register('description')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Priority
              </label>
              <select
                {...register('priority')}
                className="w-full h-10 px-3 py-2 text-sm bg-background/50 rounded-lg border border-input focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Assignee
              </label>
              <select
                {...register('assigneeId')}
                className="w-full h-10 px-3 py-2 text-sm bg-background/50 rounded-lg border border-input focus:outline-none"
              >
                <option value="">Unassigned</option>
                {workspace?.members.map((m: any) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Due Date
            </label>
            <Input type="date" {...register('dueDate')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* BULK OPERATION MODAL */}
      <Dialog isOpen={bulkActionOpen} onClose={() => setBulkActionOpen(false)} title="Bulk Operations">
        <div className="space-y-6 font-sans">
          <p className="text-sm text-muted-foreground">
            Apply bulk edits for the {selectedTaskIds.length} selected tasks.
          </p>

          <div className="border border-border p-4 rounded-xl space-y-4">
            <div className="flex items-center gap-3">
              <MoveRight className="h-5 w-5 text-indigo-500" />
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Move Status
                </label>
                <select
                  value={bulkMoveStatus}
                  onChange={(e) => setBulkMoveStatus(e.target.value as TaskStatus)}
                  className="px-3 py-1.5 text-xs bg-background/50 rounded-lg border border-border"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="REVIEW">Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>
              <Button
                variant="glass"
                size="sm"
                onClick={() => bulkMoveMutation.mutate(bulkMoveStatus)}
                disabled={bulkMoveMutation.isPending}
              >
                Apply Move
              </Button>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash className="h-5 w-5 text-rose-500" />
                <span className="text-sm font-semibold text-foreground">Delete Permanently</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={bulkDeleteMutation.isPending}
              >
                Confirm Delete
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setBulkActionOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

// DROP WRAPPER COMPONENT
const TaskDropContainer: React.FC<{ id: string; tasks: Task[]; children: React.ReactNode }> = ({
  id,
  children,
}) => {
  const { setNodeRef } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="flex-1 p-3 space-y-3 flex flex-col overflow-y-auto">
      {children}
    </div>
  );
};

// SORTABLE TASK CARD COMPONENT
const TaskCard: React.FC<{
  task: Task;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}> = ({ task, isSelected = false, onSelect, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const priorityColor = {
    LOW: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    MEDIUM: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    HIGH: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    CRITICAL: 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse',
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-card p-4 hover:shadow-lg transition-all duration-200 border cursor-grab select-none active:cursor-grabbing group relative ${
        isSelected ? 'border-primary shadow-sm bg-primary/[0.02]' : 'hover:border-foreground/20'
      }`}
      onClick={onClick}
    >
      {/* Top Header Card options */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <span
          className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded border ${
            priorityColor[task.priority]
          }`}
        >
          {task.priority}
        </span>
        <input
          type="checkbox"
          checked={isSelected}
          onClick={onSelect}
          onChange={() => {}}
          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition duration-150"
        />
      </div>

      {/* Drag handle listener area */}
      <div {...attributes} {...listeners} className="space-y-3">
        <h4 className="font-bold text-sm tracking-tight text-foreground line-clamp-2 leading-snug group-hover:text-primary transition duration-150">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Labels tag box */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.labels.map((lbl) => (
              <span
                key={lbl.id}
                style={{ backgroundColor: `${lbl.color}22`, color: lbl.color, borderColor: `${lbl.color}44` }}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border"
              >
                {lbl.name}
              </span>
            ))}
          </div>
        )}

        {/* Card Footer detail metadata */}
        <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-3 text-[10px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-2">
            {task.dueDate && (
              <span className={`flex items-center gap-1 font-sans ${isOverdue ? 'text-rose-500' : ''}`}>
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task._count && task._count.comments > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" /> {task._count.comments}
              </span>
            )}
            {task._count && task._count.attachments > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" /> {task._count.attachments}
              </span>
            )}
          </div>
          {task.assignee ? (
            <Avatar name={task.assignee.name} size="xs" />
          ) : (
            <span className="h-5 w-5 rounded-full border-dashed border border-border flex items-center justify-center text-[8px] font-bold select-none uppercase">
              U
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
