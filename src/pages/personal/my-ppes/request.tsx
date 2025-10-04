import { Card } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconHammer } from "@tabler/icons-react";

export const PersonalMyPpesRequest = () => {
  // Track page access
  usePageTracker({
    title: "Request PPE",
    icon: "file-plus",
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-muted p-4">
            <IconHammer size={48} className="text-muted-foreground" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Page Under Construction</h1>
        <p className="text-muted-foreground">This page is currently being developed. Please check back later.</p>
      </Card>
    </div>
  );
};
