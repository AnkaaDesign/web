import { Card, CardContent } from "@/components/ui/card";
import { DeploymentTable } from "./deployment-table";

interface DeploymentListProps {
  className?: string;
}

export function DeploymentList({ className }: DeploymentListProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <DeploymentTable className="h-full" />
      </CardContent>
    </Card>
  );
}
