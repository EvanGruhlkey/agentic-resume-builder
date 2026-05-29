import { AppNav } from "@/components/app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
        <div className="border-b border-zinc-200 px-4 py-4">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">
            ApplyKit
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Resume tailoring</p>
        </div>
        <div className="flex-1 py-3">
          <AppNav />
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-white">{children}</main>
    </div>
  );
}
