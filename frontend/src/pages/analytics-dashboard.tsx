import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { Loader2, TrendingUp, CheckSquare, Clock, AlertTriangle, Users } from 'lucide-react';
import apiClient from '../lib/api-client.js';
import { Card } from '../components/ui/index.js';

const COLORS = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EC4899'];
const PRIORITY_COLORS = {
  low: '#94A3B8',
  medium: '#3B82F6',
  high: '#F59E0B',
  critical: '#EF4444',
};

export const AnalyticsDashboard: React.FC = () => {
  const { workspaceId } = useParams();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard', workspaceId],
    queryFn: async () => {
      const res = await apiClient.get(`/workspaces/${workspaceId}/dashboard`);
      return res.data;
    },
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <span className="text-sm font-semibold text-muted-foreground font-sans">
          Generating analytics report...
        </span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20 font-sans">
        <p className="text-rose-500 font-bold">Failed to load analytics dashboard statistics</p>
      </div>
    );
  }

  const { summary, statusDistribution, priorityDistribution, tasksPerUser, weeklyTrends, burndownData } = stats;

  const statusPieData = [
    { name: 'To Do', value: statusDistribution.todo },
    { name: 'In Progress', value: statusDistribution.inProgress },
    { name: 'Review', value: statusDistribution.review },
    { name: 'Done', value: statusDistribution.done },
  ].filter((item) => item.value > 0);

  const priorityBarData = [
    { name: 'Low', count: priorityDistribution.low, fill: PRIORITY_COLORS.low },
    { name: 'Medium', count: priorityDistribution.medium, fill: PRIORITY_COLORS.medium },
    { name: 'High', count: priorityDistribution.high, fill: PRIORITY_COLORS.high },
    { name: 'Critical', count: priorityDistribution.critical, fill: PRIORITY_COLORS.critical },
  ];

  return (
    <div className="space-y-6 pb-12 font-sans select-none">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Workspace Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detailed breakdown of tasks progress, velocity, and team contributions.
        </p>
      </div>

      {/* CORE STATS SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Total Tasks</span>
            <p className="text-3xl font-bold text-foreground">{summary.totalTasks}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <CheckSquare className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Completion Rate</span>
            <p className="text-3xl font-bold text-foreground">{summary.completionPercentage}%</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Overdue Tasks</span>
            <p className="text-3xl font-bold text-foreground">{summary.overdueTasks}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Pending Review</span>
            <p className="text-3xl font-bold text-foreground">{summary.reviewTasks}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* CHARTS GRID SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Task Burndown Chart */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Sprint Burndown Rate</h3>
            <p className="text-xs text-muted-foreground">Ideal versus remaining active tasks.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip contentStyle={{ background: 'rgba(30, 41, 59, 0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="remaining" stroke="#6366F1" fillOpacity={0.1} fill="url(#colorRemaining)" name="Remaining Tasks" />
                <Area type="monotone" dataKey="ideal" stroke="#94A3B8" strokeDasharray="5 5" fill="none" name="Ideal Burndown" />
                <defs>
                  <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Weekly Progress Trends */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Weekly Activity Volume</h3>
            <p className="text-xs text-muted-foreground">Tasks created vs marked completed in the last 4 weeks.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip contentStyle={{ background: 'rgba(30, 41, 59, 0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="created" stroke="#F59E0B" strokeWidth={2.5} name="Created" />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2.5} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution (Pie) */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Workflow States</h3>
            <p className="text-xs text-muted-foreground">Percentage split of tasks by columns.</p>
          </div>
          <div className="h-72 flex items-center justify-center">
            {statusPieData.length > 0 ? (
              <div className="w-full h-full flex flex-col sm:flex-row items-center justify-around">
                <div className="h-56 w-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip contentStyle={{ background: 'rgba(30, 41, 59, 0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 font-sans font-semibold text-xs">
                  {statusPieData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-foreground">{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground font-sans">No tasks in workflow columns</div>
            )}
          </div>
        </Card>

        {/* Tasks per User (Team workload) */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-foreground">Resource Workloads</h3>
            <p className="text-xs text-muted-foreground">Total task assignments per user.</p>
          </div>
          <div className="h-72">
            {tasksPerUser.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksPerUser}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip contentStyle={{ background: 'rgba(30, 41, 59, 0.8)', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Assigned Tasks" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground font-sans">
                No active member assignments
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};
export default AnalyticsDashboard;
