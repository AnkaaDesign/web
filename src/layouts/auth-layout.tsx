import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const AuthLayout = () => {
  // min-h-full + w-full off the html/body/#root height:100% chain (index.css)
  // fills the real screen.
  return (
    <div className="min-h-full w-full bg-background relative overflow-x-hidden">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
};
