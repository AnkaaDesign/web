import { Outlet } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const AuthLayout = () => {
  // min-h-full + w-full (not min-h-screen/w-screen): under root `zoom: 0.8`,
  // viewport units (100vh/100vw) get scaled to 80% and leave empty strips.
  // The html/body/#root height:100% chain (index.css) makes percentage
  // heights fill the real screen inside zoomed space.
  return (
    <div className="min-h-full w-full bg-background relative overflow-x-hidden">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
};
