import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { isValidEmail } from '@/lib/dataValidation';
import { Mail, Plus, X } from 'lucide-react';

export interface CcEmailEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
  disabled?: boolean;
}

export function CcEmailEditor({
  value,
  onChange,
  suggestions,
  disabled = false,
}: CcEmailEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const valueSet = useMemo(
    () => new Set(value.map((e) => e.toLowerCase())),
    [value],
  );

  const filteredSuggestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (valueSet.has(s.toLowerCase())) return false;
      if (!needle) return true;
      return s.toLowerCase().includes(needle);
    });
  }, [suggestions, search, valueSet]);

  const trimmed = search.trim().toLowerCase();
  const showAddTyped =
    trimmed.length > 0 &&
    !valueSet.has(trimmed) &&
    !filteredSuggestions.some((s) => s.toLowerCase() === trimmed);

  const commitEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    if (!isValidEmail(normalized)) {
      toast({
        title: 'Invalid email',
        description: `"${email}" is not a valid email address.`,
        variant: 'destructive',
      });
      return;
    }
    if (valueSet.has(normalized)) {
      setSearch('');
      return;
    }
    onChange([...value, normalized]);
    setSearch('');
    setOpen(false);
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e.toLowerCase() !== email.toLowerCase()));
  };

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 mb-2 block">
        CC Recipients ({value.length})
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            No CC recipients
          </span>
        )}
        {value.map((email) => (
          <Badge
            key={email}
            variant="secondary"
            className="bg-blue-100 text-blue-800 text-xs pr-1"
          >
            <Mail className="h-3 w-3 mr-1" />
            {email}
            <button
              type="button"
              onClick={() => removeEmail(email)}
              disabled={disabled}
              className="ml-1 rounded-full hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed p-0.5"
              aria-label={`Remove ${email}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-7 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add CC
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search or type email…"
                value={search}
                onValueChange={setSearch}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && showAddTyped) {
                    e.preventDefault();
                    commitEmail(search);
                  }
                }}
              />
              <CommandList>
                {showAddTyped && (
                  <CommandGroup heading="New">
                    <CommandItem
                      value={`__add__${trimmed}`}
                      onSelect={() => commitEmail(search)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add "{trimmed}"
                    </CommandItem>
                  </CommandGroup>
                )}
                {filteredSuggestions.length > 0 && (
                  <CommandGroup heading="Suggested">
                    {filteredSuggestions.map((email) => (
                      <CommandItem
                        key={email}
                        value={email}
                        onSelect={() => commitEmail(email)}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {email}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!showAddTyped && filteredSuggestions.length === 0 && (
                  <CommandEmpty>
                    {suggestions.length === 0
                      ? 'No prior CCs. Type an email to add.'
                      : 'No matches. Type a full email to add.'}
                  </CommandEmpty>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
