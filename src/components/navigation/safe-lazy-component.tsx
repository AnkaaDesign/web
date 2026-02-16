import { Suspense } from "react";
import type { ComponentType } from "react";
import { LoadingPage } from "@/components/navigation/loading-page";

interface SafeLazyComponentProps {
  Component: ComponentType<any>;
  props?: any;
}

export function SafeLazyComponent({ Component, props = {} }: SafeLazyComponentProps) {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Component {...props} />
    </Suspense>
  );
}
