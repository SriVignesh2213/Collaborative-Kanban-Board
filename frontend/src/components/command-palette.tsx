import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, LayoutDashboard, Settings, UserPlus, Eye, PlusCircle, CheckSquare, Sun, Moon } from 'lucide-react';
import apiClient from '../lib/api-client.js';
import { useToast } from './ui/toast.js';
import { Task } from '../types/index.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateTask?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenCreateTask }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const workspaceMatch = location.pathname.match(/\/workspaces\/([^/]+)/);
  const workspaceId = useParams().workspaceId || (workspaceMatch ? workspaceMatch[1] : undefined);
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    toast(`Switched to ${isDark ? 'Dark' : 'Light'} Mode`, 'info');
  };

  // Keyboard shortcut listener to open/close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Fetch workspace tasks for search index
  const { data } = useQuery<{ tasks: Task[] }>({
    queryKey: ['tasks', workspaceId, 'search', query],
    queryFn: async () => {
      if (!workspaceId || query.length < 2) return { tasks: [] };
      const res = await apiClient.get(`/workspaces/${workspaceId}/tasks`, {
        params: { search: query, limit: 5 },
      });
      return res.data;
    },
    enabled: !!workspaceId && query.length >= 2,
  });

  const matchingTasks = data?.tasks || [];

  // Static commands list
  const staticCommands = [
    {
      icon: <LayoutDashboard className="mr-3 h-4 w-4" />,
      label: 'Go to Board View',
      action: () => {
        if (workspaceId) navigate(`/workspaces/${workspaceId}`);
      },
    },
    {
      icon: <Settings className="mr-3 h-4 w-4" />,
      label: 'Go to Workspace Settings',
      action: () => {
        if (workspaceId) navigate(`/workspaces/${workspaceId}/settings`);
      },
    },
    {
      icon: <PlusCircle className="mr-3 h-4 w-4" />,
      label: 'Create New Task',
      action: () => {
        if (onOpenCreateTask) onOpenCreateTask();
      },
    },
    {
      icon: <Eye className="mr-3 h-4 w-4" />,
      label: 'Go to Analytics Dashboard',
      action: () => {
        if (workspaceId) navigate(`/workspaces/${workspaceId}/analytics`);
      },
    },
    {
      icon: (
        <>
          <Sun className="mr-3 h-4 w-4 block dark:hidden" />
          <Moon className="mr-3 h-4 w-4 hidden dark:block" />
        </>
      ),
      label: 'Toggle Dark / Light Theme',
      action: toggleDarkMode,
    },
  ];

  const filteredCommands = staticCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = filteredCommands.length + matchingTasks.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      triggerSelectedItem();
    }
  };

  const triggerSelectedItem = () => {
    if (selectedIndex < filteredCommands.length) {
      filteredCommands[selectedIndex].action();
    } else {
      const taskIndex = selectedIndex - filteredCommands.length;
      const targetTask = matchingTasks[taskIndex];
      if (targetTask && workspaceId) {
        navigate(`/workspaces/${workspaceId}?taskId=${targetTask.id}`);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Main Palette */}
      <div
        className="glass relative z-10 w-full max-w-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-fade-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center border-b border-border px-4 py-3 bg-background/30">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
            placeholder="Type a command or search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {totalItems === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          )}

          {/* Commands Section */}
          {filteredCommands.length > 0 && (
            <div className="mb-2">
              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                System Commands
              </div>
              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={cmd.label}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    className={`flex items-center px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-100 [&>svg]:opacity-80 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.01] [&>svg]:text-primary-foreground'
                        : 'text-foreground hover:bg-secondary [&>svg]:text-muted-foreground'
                    }`}
                  >
                    {cmd.icon}
                    <span className="font-medium font-sans">{cmd.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tasks Section */}
          {matchingTasks.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Matching Tasks
              </div>
              {matchingTasks.map((task, idx) => {
                const absoluteIdx = filteredCommands.length + idx;
                const isSelected = absoluteIdx === selectedIndex;
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (workspaceId) {
                        navigate(`/workspaces/${workspaceId}?taskId=${task.id}`);
                      }
                      onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-100 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.01]'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <div className="flex items-center truncate">
                      <CheckSquare className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate font-sans">{task.title}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-sans font-bold capitalize ${
                        task.priority === 'CRITICAL'
                          ? 'bg-rose-500/10 text-rose-500'
                          : task.priority === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      {task.priority.toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
