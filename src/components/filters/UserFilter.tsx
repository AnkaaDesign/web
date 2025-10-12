import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface UserFilterProps {
  value: string[];
  onChange: (selected: string[]) => void;
  users: User[];
  placeholder?: string;
  className?: string;
  maxHeight?: number;
  showSearch?: boolean;
}

export function UserFilter({
  value = [],
  onChange,
  users,
  placeholder = "Selecionar usuários",
  className,
  maxHeight = 300,
  showSearch = true,
}: UserFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const searchLower = search.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
    );
  }, [users, search]);

  const handleToggle = (userId: string) => {
    const newValue = value.includes(userId)
      ? value.filter((id) => id !== userId)
      : [...value, userId];
    onChange(newValue);
  };

  const handleSelectAll = () => {
    if (value.length === filteredUsers.length) {
      onChange([]);
    } else {
      onChange(filteredUsers.map((u) => u.id));
    }
  };

  const getSelectedLabel = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const user = users.find((u) => u.id === value[0]);
      return user?.name || value[0];
    }
    return `${value.length} usuários`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <span className="truncate">{getSelectedLabel()}</span>
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-mono text-xs">
              {value.length}
            </Badge>
          )}
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {showSearch && (
          <div className="p-2 border-b">
            <div className="relative">
              <IconSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        )}
        <div className="border-b p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={value.length === filteredUsers.length && filteredUsers.length > 0}
              className="mr-2"
            />
            Selecionar todos
          </Button>
        </div>
        <ScrollArea style={{ maxHeight: `${maxHeight}px` }}>
          <div className="p-2 space-y-1">
            {filteredUsers.map((user) => (
              <Button
                key={user.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleToggle(user.id)}
              >
                <Checkbox
                  checked={value.includes(user.id)}
                  className="mr-2"
                />
                <div className="flex-1 text-left">
                  <div className="font-medium">{user.name}</div>
                  {user.email && (
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  )}
                </div>
              </Button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhum usuário encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
