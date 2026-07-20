import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Settings,
  Plus,
  LogOut,
  Users,
  Eye,
  Hash,
  Menu,
  X,
  Keyboard,
  UserPlus,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../contexts/auth-context.js';
import { useSocket } from '../contexts/socket-context.js';
import { useToast } from '../components/ui/toast.js';
import { Avatar, Button, Dialog, Input } from '../components/ui/index.js';
import { CommandPalette } from '../components/command-palette.js';
import apiClient from '../lib/api-client.js';
import { Workspace } from '../types/index.js';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const workspaceMatch = location.pathname.match(/\/workspaces\/([^/]+)/);
  const workspaceId = useParams().workspaceId || (workspaceMatch ? workspaceMatch[1] : undefined);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const {
    onlineUsers,
    cursors,
    broadcastCursorMove,
    setActiveWorkspaceId,
  } = useSocket();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  // Mobile sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync active workspace to Socket Context
  useEffect(() => {
    setActiveWorkspaceId(workspaceId || null);
  }, [workspaceId, setActiveWorkspaceId]);

  // Command Palette & Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
      // Ctrl+Shift+K -> Create Task Modal
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const createBtn = document.getElementById('btn-new-task');
        if (createBtn) {
          createBtn.click();
        } else if (workspaceId) {
          navigate(`/workspaces/${workspaceId}`, { state: { openCreateTask: true } });
        }
      }
      // Shortcuts Help
      if (e.key === '?') {
        // Prevent if typing in inputs
        if (['INPUT', 'TEXTAREA'].includes((e.target as any).tagName)) return;
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch user workspaces
  const { data: workspaces = [], isLoading } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiClient.get('/workspaces');
      return res.data;
    },
  });

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

  // Track Mouse Movements for cursor sharing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!workspaceId) return;
    const { clientX, clientY } = e;
    broadcastCursorMove(clientX, clientY);
  };

  // Mutations
  const createWorkspaceMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.post('/workspaces', { name });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsCreateOpen(false);
      setNewWorkspaceName('');
      toast(`Workspace "${data.name}" created!`, 'success');
      navigate(`/workspaces/${data.id}`);
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to create workspace', 'error');
    },
  });

  const joinWorkspaceMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiClient.post('/workspaces/join', { inviteCode: code });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsJoinOpen(false);
      setInviteCode('');
      toast(`Joined workspace successfully!`, 'success');
      navigate(`/workspaces/${data.workspace.id}`);
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to join workspace', 'error');
    },
  });

  const handleLogout = async () => {
    await logout();
    toast('Logged out successfully', 'info');
    navigate('/login');
  };

  const navLinks = workspaceId
    ? [
        {
          label: 'Kanban Board',
          path: `/workspaces/${workspaceId}`,
          icon: <LayoutDashboard className="h-4.5 w-4.5" />,
        },
        {
          label: 'Workspace Analytics',
          path: `/workspaces/${workspaceId}/analytics`,
          icon: <Eye className="h-4.5 w-4.5" />,
        },
        {
          label: 'Settings',
          path: `/workspaces/${workspaceId}/settings`,
          icon: <Settings className="h-4.5 w-4.5" />,
        },
      ]
    : [];

  return (
    <div
      className="min-h-screen flex bg-background relative overflow-hidden select-none"
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Cursor Overlays */}
      {Object.values(cursors).map((c) => (
        <div
          key={c.userId}
          className="collaborator-cursor"
          style={{
            left: c.x,
            top: c.y,
          }}
        >
          {/* Neon Mouse Cursor arrow pointer */}
          <svg
            className="h-6 w-6 filter drop-shadow-md"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 3V19.4673C3 19.8661 3.48607 20.0632 3.76449 19.7785L8.52843 14.8988L14.7709 21.2933C14.9392 21.4657 15.2155 21.4725 15.3922 21.3086L17.7981 19.0763C17.9734 18.9136 17.9806 18.6416 17.8143 18.47L11.6033 12.1L17.9546 11.595C18.258 11.5709 18.3744 11.1963 18.1408 11.0029L3.77123 3.09062C3.48972 2.93566 3 3.09459 3 3Z"
              fill={c.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
          <div
            className="ml-4 -mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md font-sans border border-white/20 select-none whitespace-nowrap"
            style={{ backgroundColor: c.color }}
          >
            {c.userName}
          </div>
        </div>
      ))}

      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 glass border-r border-border h-screen shrink-0 relative z-20">
        {/* Workspace Selector Brand */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-lg shadow-md shadow-primary/20">
              S
            </div>
            <span className="font-extrabold text-lg tracking-tight font-sans bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-500">
              SyncBoard
            </span>
          </div>
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded-lg transition"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Workspace List Selection Dropdown */}
        <div className="p-4">
          <label className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2">
            Workspaces
          </label>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                to={`/workspaces/${w.id}`}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                  w.id === workspaceId
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-foreground hover:bg-secondary border border-transparent'
                }`}
              >
                <div className="flex items-center truncate">
                  <Hash className="h-4.5 w-4.5 mr-2 opacity-60" />
                  <span className="truncate font-sans font-semibold">{w.name}</span>
                </div>
              </Link>
            ))}

            {workspaces.length === 0 && !isLoading && (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No workspaces created yet
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              size="sm"
              variant="glass"
              onClick={() => setIsCreateOpen(true)}
              className="text-[11px] font-semibold h-9"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
            <Button
              size="sm"
              variant="glass"
              onClick={() => setIsJoinOpen(true)}
              className="text-[11px] font-semibold h-9"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Join
            </Button>
          </div>
        </div>

        {/* WORKSPACE SUB-NAVIGATION LINKS */}
        <nav className="flex-1 px-4 py-3 space-y-1 border-t border-border overflow-y-auto">
          {workspaceId ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Active Workspace
              </div>
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-secondary text-primary border border-primary/20 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {link.icon}
                    <span className="font-semibold font-sans">{link.label}</span>
                  </Link>
                );
              })}
            </>
          ) : (
            <div className="text-center py-10 text-xs text-muted-foreground font-sans">
              Select or create a workspace to begin managing tasks.
            </div>
          )}
        </nav>

        {/* ONLINE MEMBERS PRESENCE PANEL */}
        {workspaceId && activeWorkspace && onlineUsers.length > 0 && (
          <div className="px-5 py-4 border-t border-border bg-slate-500/5">
            <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2">
              <Users className="h-3.5 w-3.5" /> Teammates Online
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
              {onlineUsers.map((u) => (
                <div key={u.userId} title={`${u.name} is active`} className="relative">
                  <Avatar name={u.name} size="sm" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USER PROFILE INFO PANEL & LOGOUT */}
        <div className="p-4 border-t border-border bg-background/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <Avatar name={user?.name || 'User'} size="sm" />
            <div className="truncate">
              <p className="text-sm font-bold text-foreground leading-tight truncate font-sans">
                {user?.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-rose-500 p-1.5 hover:bg-secondary rounded-lg transition"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER & SLIDEOUT PANEL */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden z-10">
        <header className="md:hidden h-14 border-b border-border flex items-center justify-between px-4 glass shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-foreground p-1 hover:bg-secondary rounded-lg transition"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-extrabold text-base tracking-tight font-sans bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-500">
              SyncBoard
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar name={user?.name || 'User'} size="sm" />
          </div>
        </header>

        {/* MAIN DISPLAY PAGE LAYOUT CONTAINER */}
        <main className="flex-1 overflow-y-auto relative p-4 md:p-6 bg-slate-500/[0.02]">
          {/* Subtle neon glowing spotlight spots */}
          <div className="glow-spot top-[10%] right-[10%] opacity-40 bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10" />
          <div className="glow-spot bottom-[15%] left-[5%] opacity-30" />
          <Outlet />
        </main>
      </div>

      {/* COMMAND PALETTE CONTAINER MODAL */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenCreateTask={() => {
          setIsCommandOpen(false);
          setTimeout(() => {
            const createBtn = document.getElementById('btn-new-task');
            if (createBtn) {
              createBtn.click();
            } else if (workspaceId) {
              navigate(`/workspaces/${workspaceId}`, { state: { openCreateTask: true } });
            }
          }, 100);
        }}
      />

      {/* CREATE WORKSPACE DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Workspace">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-sans">
            Workspaces contain columns, labels, comments, and members.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Workspace Name
            </label>
            <Input
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. Acme Engineering, Product Launch"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => createWorkspaceMutation.mutate(newWorkspaceName)}
              disabled={!newWorkspaceName.trim() || createWorkspaceMutation.isPending}
            >
              {createWorkspaceMutation.isPending ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* JOIN WORKSPACE DIALOG */}
      <Dialog isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} title="Join Workspace">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-sans">
            Enter a workspace unique invite code to join.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Invite Code
            </label>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. FE6D89C2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsJoinOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => joinWorkspaceMutation.mutate(inviteCode)}
              disabled={!inviteCode.trim() || joinWorkspaceMutation.isPending}
            >
              {joinWorkspaceMutation.isPending ? 'Joining...' : 'Join Workspace'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* SHORTCUTS MODAL */}
      <Dialog isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} title="Keyboard Shortcuts">
        <div className="space-y-4">
          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 text-sm font-medium font-sans">
            <div className="border border-border p-3.5 rounded-xl glass-card">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Board Shortcuts
              </span>
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="whitespace-nowrap">Open Palette</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs font-mono shrink-0">
                    Ctrl+K
                  </kbd>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="whitespace-nowrap">Create Task</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs font-mono shrink-0">
                    Ctrl+Shift+K
                  </kbd>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="whitespace-nowrap">Global Helpers</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs font-mono shrink-0">
                    ?
                  </kbd>
                </div>
              </div>
            </div>

            <div className="border border-border p-3.5 rounded-xl glass-card">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Quick Shortcuts
              </span>
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="whitespace-nowrap">Press Escape</span>
                  <span className="text-xs text-muted-foreground text-right">Dismiss Modal</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="whitespace-nowrap">Mouse Cursor</span>
                  <span className="text-xs text-muted-foreground text-right">Collaborative Drawing</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setIsShortcutsOpen(false)}>
              Got it!
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MOBILE SLIDEOUT DRAWER MENU Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="relative w-64 glass border-r border-border h-full flex flex-col z-10"
          >
            {/* Logo inside mobile sidebar */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-extrabold text-base tracking-tight font-sans text-foreground">
                SyncBoard
              </span>
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* List and Nav links mapped */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Workspaces
                </span>
                {workspaces.map((w) => (
                  <Link
                    key={w.id}
                    to={`/workspaces/${w.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-foreground hover:bg-secondary font-sans font-semibold mb-1"
                  >
                    # {w.name}
                  </Link>
                ))}
                
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => {
                      setMobileOpen(false);
                      setIsCreateOpen(true);
                    }}
                    className="text-[11px] font-semibold h-9"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> New
                  </Button>
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => {
                      setMobileOpen(false);
                      setIsJoinOpen(true);
                    }}
                    className="text-[11px] font-semibold h-9"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Join
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground font-sans font-semibold"
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            {/* Profile */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <span className="text-sm font-bold truncate">{user?.name}</span>
              <button onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
export default DashboardLayout;
