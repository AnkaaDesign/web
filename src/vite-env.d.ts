/// <reference types="vite/client" />

declare const __APP_HASH__: string;

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
