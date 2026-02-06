import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateTask, useUpdateTask, useDeleteTask, useTeamMembers } from '@/hooks/useTasks';
import { Task, TaskCreateInput, TaskUpdateInput, TASK_CATEGORIES, RECURRING_PATTERNS, STATUS_CONFIG } from '@/types/tasks';
import { Trash2, CalendarIcon } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}

interface TaskFormData {
  title: string;
  description: string;
  assignee_name: string;
  status: string;
  priority: string;
  category: string;
  visibility: string;
  due_date: string;
  is_recurring: boolean;
  recurring_pattern: string;
}

export function TaskModal({ open, onOpenChange, task }: TaskModalProps) {
  const isEditing = !!task;
  const { register, handleSubmit, setValue, watch, reset } = useForm<TaskFormData>();
  const [showRecurringOptions, setShowRecurringOptions] = useState(task?.is_recurring || false);

  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: teamMembers } = useTeamMembers();

  // Initialize form with task data
  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || '',
        assignee_name: task.assignee_name || '',
        status: task.status,
        priority: task.priority,
        category: task.category || 'operations',
        visibility: task.visibility,
        due_date: task.due_date || '',
        is_recurring: task.is_recurring,
        recurring_pattern: task.recurring_pattern || 'daily',
      });
      setShowRecurringOptions(task.is_recurring);
    } else {
      reset({
        title: '',
        description: '',
        assignee_name: '',
        status: 'todo',
        priority: 'medium',
        category: 'operations',
        visibility: 'team',
        due_date: '',
        is_recurring: false,
        recurring_pattern: 'daily',
      });
      setShowRecurringOptions(false);
    }
  }, [task, reset]);

  const onSubmit = async (data: TaskFormData) => {
    const taskData: TaskCreateInput = {
      title: data.title,
      description: data.description || undefined,
      assignee_name: data.assignee_name || undefined,
      status: data.status as any,
      priority: data.priority as any,
      category: data.category || undefined,
      visibility: data.visibility as any,
      due_date: data.due_date || undefined,
      is_recurring: data.is_recurring,
      recurring_pattern: data.is_recurring ? data.recurring_pattern : undefined,
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id: task.id, updates: taskData });
    } else {
      await createMutation.mutateAsync(taskData);
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    await deleteMutation.mutateAsync(task.id);
    onOpenChange(false);
  };

  const isRecurringChecked = watch('is_recurring');

  useEffect(() => {
    setShowRecurringOptions(isRecurringChecked);
  }, [isRecurringChecked]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Add Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              {...register('title', { required: true })}
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add details..."
              rows={3}
              {...register('description')}
            />
          </div>

          {/* Assignee */}
          <div>
            <Label htmlFor="assignee_name">Assignee *</Label>
            <Select
              value={watch('assignee_name')}
              onValueChange={(value) => setValue('assignee_name', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers?.map((member) => (
                  <SelectItem key={member.id} value={member.name}>
                    {member.name} {member.role && `(${member.role})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status and Priority - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(value) => setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category and Visibility - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_CATEGORIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={watch('visibility')}
                onValueChange={(value) => setValue('visibility', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">👥 Team (All Admins)</SelectItem>
                  <SelectItem value="internal">🔒 Internal (Sensitive)</SelectItem>
                  <SelectItem value="private">👤 Private (Only Me)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <Label htmlFor="due_date">Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !watch('due_date') && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {watch('due_date') ? format(new Date(watch('due_date')), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch('due_date') ? new Date(watch('due_date')) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      // Convert to ISO date string (YYYY-MM-DD) for database consistency
                      setValue('due_date', date.toISOString().split('T')[0]);
                    } else {
                      setValue('due_date', '');
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Recurring Task Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_recurring"
              checked={watch('is_recurring')}
              onCheckedChange={(checked) => setValue('is_recurring', !!checked)}
            />
            <Label htmlFor="is_recurring" className="cursor-pointer">
              Recurring Task
            </Label>
          </div>

          {/* Recurring Pattern - conditionally shown */}
          {showRecurringOptions && (
            <div>
              <Label htmlFor="recurring_pattern">Repeat</Label>
              <Select
                value={watch('recurring_pattern')}
                onValueChange={(value) => setValue('recurring_pattern', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRING_PATTERNS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Footer buttons */}
          <DialogFooter className="flex justify-between items-center">
            <div>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {isEditing ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
