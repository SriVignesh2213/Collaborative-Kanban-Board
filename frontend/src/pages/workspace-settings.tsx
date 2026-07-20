import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Trash2, LogOut, Check, Users, ShieldAlert, Key } from 'lucide-react';
import apiClient from '../lib/api-client.js';
import { useAuth } from '../contexts/auth-context.js';
import { useToast } from '../components/ui/toast.js';
import { Card, Button, Input, Avatar } from '../components/ui/index.js';
import { Workspace, Role } from '../types/index.js';

export const WorkspaceSettings: React.FC = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState(false);

  // Queries
  const { data: workspace, isLoading } = useQuery<Workspace>({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspaceId}`);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  // Sync workspace name when data loads (replaces deprecated onSuccess)
  useEffect(() => {
    if (workspace?.name) {
      setNewName(workspace.name);
    }
  }, [workspace?.name]);


  // Check roles
  const currentMember = workspace?.members.find((m) => m.userId === user?.id);
  const isOwner = currentMember?.role === 'OWNER';
  const isAdmin = currentMember?.role === 'ADMIN' || isOwner;

  // Mutations
  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiClient.patch(`/workspaces/${workspaceId}`, { name });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast('Workspace renamed successfully!', 'success');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to rename workspace', 'error');
    },
  });

  const inviteResetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/workspaces/${workspaceId}/invite-code`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      toast('Invite code regenerated!', 'success');
    },
  });

  const roleUpdateMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const res = await apiClient.patch(`/workspaces/${workspaceId}/role`, { userId, role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      toast('Member role updated successfully!', 'success');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Role update failed', 'error');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/workspaces/${workspaceId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast('Left workspace', 'info');
      navigate('/');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Failed to leave', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/workspaces/${workspaceId}`);
    },
    onSuccess: () => {
      queryClient.setQueryData(['workspaces'], (old: Workspace[] | undefined) => 
        old ? old.filter(w => w.id !== workspaceId) : []
      );
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast('Workspace deleted permanently', 'success');
      navigate('/');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error || 'Delete failed', 'error');
    },
  });

  const handleCopyLink = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.inviteCode);
    setCopied(true);
    toast('Invite code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === workspace?.name) return;
    renameMutation.mutate(newName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 font-sans">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <span className="text-sm font-semibold text-muted-foreground mt-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 font-sans">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Workspace Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure invite properties, labels, teammates roles, and general preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT/RIGHT SIDE FORM SETTINGS (Col 2) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* General Workspace Info Rename */}
          <Card className="p-6">
            <h3 className="font-bold text-base text-foreground mb-4">General Preferences</h3>
            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Workspace Name
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="Workspace Name"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!isAdmin || renameMutation.isPending || newName === workspace?.name}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          {/* Members Listing & Role Manager */}
          <Card className="p-6">
            <div className="flex items-center gap-1.5 mb-4 border-b border-border pb-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-base text-foreground">Teammate Members</h3>
            </div>

            <div className="space-y-4">
              {workspace?.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3.5 border border-border/60 bg-secondary/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.user.name} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-foreground leading-snug">
                        {member.user.name} {member.user.id === user?.id && <span className="text-xs text-primary font-medium">(You)</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-none font-mono">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role Dropdown (Only visible/editable for Owner, except self) */}
                    <select
                      value={member.role}
                      disabled={!isOwner || member.userId === user?.id}
                      onChange={(e) =>
                        roleUpdateMutation.mutate({
                          userId: member.user.id,
                          role: e.target.value as Role,
                        })
                      }
                      className="text-xs font-semibold bg-background/50 rounded-lg border border-border px-2.5 py-1.5 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>

        {/* RIGHT METADATA PANEL (Col 1) */}
        <div className="space-y-6">
          
          {/* Invite Code settings */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-1.5">
              <Key className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-sm text-foreground">Invite Token</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this invite code with teammates to grant workspace access.
            </p>
            <div className="flex items-center gap-2 bg-secondary/15 border border-border p-3 rounded-xl justify-between">
              <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                {workspace?.inviteCode}
              </span>
              <button
                onClick={handleCopyLink}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-secondary rounded-lg transition"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {isAdmin && (
              <Button
                variant="glass"
                size="sm"
                className="w-full text-xs font-bold"
                onClick={() => {
                  if (window.confirm('Regenerating invite code will invalidate the old invite code. Continue?')) {
                    inviteResetMutation.mutate();
                  }
                }}
                disabled={inviteResetMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Invite Code
              </Button>
            )}
          </Card>

          {/* Danger Zone Actions */}
          <Card className="p-6 border-rose-500/20 bg-rose-500/[0.01] space-y-4">
            <h3 className="font-bold text-sm text-rose-500 flex items-center gap-1.5">
              <ShieldAlert className="h-5 w-5" /> Danger Zone
            </h3>

            <div className="space-y-3">
              {!isOwner && (
                <Button
                  variant="glass"
                  className="w-full text-rose-500 hover:bg-rose-500/10 border-rose-500/20 text-xs font-bold"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to leave this workspace?')) {
                      leaveMutation.mutate();
                    }
                  }}
                  disabled={leaveMutation.isPending}
                >
                  <LogOut className="h-4 w-4 mr-1.5" /> Leave Workspace
                </Button>
              )}

              {isOwner && (
                <Button
                  variant="destructive"
                  className="w-full text-xs font-bold shadow-rose-500/10"
                  onClick={() => {
                    if (window.confirm('Deleting this workspace will delete all columns, tasks, labels, and comments. This action CANNOT be undone. Continue?')) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete Workspace
                </Button>
              )}
            </div>
          </Card>

        </div>

      </div>
    </div>
  );
};
export default WorkspaceSettings;
