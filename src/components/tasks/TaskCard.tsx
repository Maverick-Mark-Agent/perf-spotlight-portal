import { Task, PRIORITY_COLORS, TASK_CATEGORIES } from '@/types/tasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Lock } from 'lucide-react';
import { formatDistanceToNow, isPast, isToday, isTomorrow, parseISO } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function TaskCard({ task, onEdit, draggable = true, onDragStart, onDragEnd }: TaskCardProps) {
  const priorityColor = PRIORITY_COLORS[task.priority];

  // Format due date
  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;

    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };

  const getDueClass = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = parseISO(dateStr);
    if (isPast(date) && !isToday(date)) return 'overdue';
    if (isToday(date)) return 'today';
    return '';
  };

  const dueDate = formatDueDate(task.due_date);
  const dueClass = getDueClass(task.due_date);

  return (
    <div
      className="group relative bg-[#21262d] border border-[#30363d] rounded-lg p-3.5 cursor-grab hover:border-[#58a6ff] hover:-translate-y-0.5 transition-all"
      style={{ borderLeftWidth: '3px', borderLeftColor: priorityColor.border }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Edit button - shows on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 bg-[#30363d] hover:bg-[#484f58] text-[#8b949e] hover:text-[#f0f6fc]"
          onClick={() => onEdit(task)}
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>

      {/* Title */}
      <div className="text-sm font-medium text-[#f0f6fc] mb-2 pr-8 leading-snug">
        {task.title}
      </div>

      {/* Metadata tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {/* Assignee */}
        {task.assignee_name && (
          <Badge
            variant="secondary"
            className="bg-[#1f6feb33] text-[#58a6ff] border-0 text-xs font-medium px-2 py-0.5"
          >
            {task.assignee_name}
          </Badge>
        )}

        {/* Due date */}
        {dueDate && (
          <Badge
            variant="outline"
            className={`text-xs font-medium px-2 py-0.5 ${
              dueClass === 'overdue'
                ? 'bg-[#f8514933] text-[#f85149] border-[#f85149]'
                : dueClass === 'today'
                ? 'bg-[#d2992233] text-[#d29922] border-[#d29922]'
                : 'bg-[#21262d] text-[#8b949e] border-[#30363d]'
            }`}
          >
            {dueDate}
          </Badge>
        )}

        {/* Recurring indicator */}
        {task.is_recurring && (
          <Badge
            variant="secondary"
            className="bg-[#23883933] text-[#3fb950] border-0 text-xs font-medium px-2 py-0.5"
          >
            🔄 {task.recurring_pattern || 'Recurring'}
          </Badge>
        )}

        {/* Internal visibility indicator */}
        {task.visibility === 'internal' && (
          <Badge
            variant="outline"
            className="bg-[#da363333] text-[#da3633] border-[#da3633] text-xs font-medium px-2 py-0.5"
          >
            <Lock className="h-2.5 w-2.5 mr-1" />
            Internal
          </Badge>
        )}

        {/* Private visibility indicator */}
        {task.visibility === 'private' && (
          <Badge
            variant="outline"
            className="bg-[#8b949e33] text-[#8b949e] border-[#8b949e] text-xs font-medium px-2 py-0.5"
          >
            <Lock className="h-2.5 w-2.5 mr-1" />
            Private
          </Badge>
        )}

        {/* Category badge */}
        {task.category && TASK_CATEGORIES[task.category as keyof typeof TASK_CATEGORIES] && (
          <Badge
            variant="outline"
            className="bg-[#21262d] text-[#8b949e] border-[#30363d] text-xs font-medium px-2 py-0.5"
          >
            {TASK_CATEGORIES[task.category as keyof typeof TASK_CATEGORIES].label}
          </Badge>
        )}
      </div>

      {/* Description preview */}
      {task.description && (
        <div className="text-xs text-[#8b949e] leading-relaxed line-clamp-2">
          {task.description.slice(0, 80)}
          {task.description.length > 80 ? '...' : ''}
        </div>
      )}
    </div>
  );
}
