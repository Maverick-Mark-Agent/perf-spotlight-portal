import { useState, useMemo } from 'react';
import { useTasks, useMoveTask } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertCircle, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react';
import { Task, TaskStatus, STATUS_CONFIG } from '@/types/tasks';
import { isPast, parseISO } from 'date-fns';

type FilterAssignee = 'all' | 'Thomas' | 'Div' | 'Hussain' | 'Hassan' | 'Sarah';

export default function TasksPage() {
  const [selectedFilter, setSelectedFilter] = useState<FilterAssignee>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useTasks();
  const moveMutation = useMoveTask();

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (selectedFilter === 'all') return tasks;
    return tasks.filter((task) => task.assignee_name === selectedFilter);
  }, [tasks, selectedFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const openTasks = filteredTasks.filter(
      (t) => t.status === 'todo' || t.status === 'in_progress'
    ).length;
    const urgentTasks = filteredTasks.filter(
      (t) => t.priority === 'urgent' && t.status !== 'done'
    ).length;
    const overdueTasks = filteredTasks.filter((t) => {
      if (!t.due_date || t.status === 'done') return false;
      return isPast(parseISO(t.due_date));
    }).length;
    const completedTasks = filteredTasks.filter((t) => t.status === 'done').length;

    return { openTasks, urgentTasks, overdueTasks, completedTasks };
  }, [filteredTasks]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  // Drag and drop handlers
  const handleDragStart = (taskId: string) => (e: React.DragEvent) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (status: TaskStatus) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    await moveMutation.mutateAsync({ id: draggedTaskId, status });
    setDraggedTaskId(null);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📋 Maverick Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Managed by Kit 🦊 • Drag to move • Click to edit
          </p>
        </div>
        <Button onClick={handleAddTask}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-foreground">{stats.openTasks}</p>
                <p className="text-sm text-muted-foreground mt-1">Open Tasks</p>
              </div>
              <ListTodo className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-red-500">{stats.urgentTasks}</p>
                <p className="text-sm text-muted-foreground mt-1">Urgent</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-orange-500">{stats.overdueTasks}</p>
                <p className="text-sm text-muted-foreground mt-1">Overdue</p>
              </div>
              <CalendarClock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-semibold text-green-500">{stats.completedTasks}</p>
                <p className="text-sm text-muted-foreground mt-1">Completed</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'Thomas', 'Div', 'Hussain', 'Hassan', 'Sarah'] as FilterAssignee[]).map(
          (filter) => (
            <Button
              key={filter}
              variant={selectedFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter}
            </Button>
          )
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-kanban gap-4">
        {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(
          ([status, config]) => {
            const columnTasks = tasksByStatus[status];

            return (
              <div
                key={status}
                className="flex flex-col bg-card border border-border rounded-lg"
              >
                {/* Column Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {config.label}
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Column Cards (Drop Zone) */}
                <div
                  className="flex-1 p-3 space-y-2.5 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(status)}
                >
                  {columnTasks.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic text-center py-8">
                      Drop tasks here
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={handleEditTask}
                        onDragStart={handleDragStart(task.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Task Modal */}
      <TaskModal open={isModalOpen} onOpenChange={setIsModalOpen} task={selectedTask} />

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground">
        <p>Tasks auto-extracted from Granola meetings • Message Kit in Slack to manage tasks</p>
        <p className="mt-2">
          Slack commands: "add task: [title] for [person]" • "mark [task] done" • "what's due today?"
        </p>
      </footer>
    </div>
  );
}
