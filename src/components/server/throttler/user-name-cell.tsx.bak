import { useQuery } from "@tanstack/react-query";
import { userService } from "../../../api-client/user";
import { IconUser } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserNameCellProps {
  userId: string;
}

export function UserNameCell({ userId }: UserNameCellProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => userService.getUserById(userId, { include: { sector: true } }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span className="text-sm text-muted-foreground" title={userId}>
          ID: {userId.substring(0, 8)}...
        </span>
      </div>
    );
  }

  const user = data.data;
  return (
    <div className="flex items-center gap-2">
      <IconUser className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <span className="text-sm truncate" title={`${user.name} (${userId})`}>
        {user.name}
      </span>
    </div>
  );
}
