import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const AuthLayout = () => {
  return (
    <div className="min-h-screen w-screen bg-background relative overflow-x-hidden">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
};
