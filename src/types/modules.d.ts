// Ambient module declarations for optional/conditional dependencies.
// Prevents TS2307 "Cannot find module" errors during type-checking.

declare module "playwright" {
  interface LaunchOptions {
    headless?: boolean;
  }
  interface NewPageOptions {
    userAgent?: string;
  }
  interface GotoOptions {
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
    timeout?: number;
  }
  interface Page {
    goto(url: string, options?: GotoOptions): Promise<unknown>;
    content(): Promise<string>;
    evaluate<T>(fn: () => T): Promise<T>;
    waitForTimeout(ms: number): Promise<void>;
    waitForSelector(selector: string, options?: unknown): Promise<unknown>;
    close(): Promise<void>;
    $$(selector: string): Promise<unknown[]>;
    $(selector: string): Promise<unknown | null>;
  }
  interface Browser {
    newPage(options?: NewPageOptions): Promise<Page>;
    close(): Promise<void>;
  }
  interface BrowserType {
    launch(options?: LaunchOptions): Promise<Browser>;
  }
  export const chromium: BrowserType;
}

declare module "p-queue" {
  interface Options {
    concurrency?: number;
    interval?: number;
    intervalCap?: number;
  }
  export default class PQueue {
    constructor(options?: Options);
    add<T>(fn: () => Promise<T>): Promise<T>;
    onIdle(): Promise<void>;
    readonly size: number;
    readonly pending: number;
  }
}
