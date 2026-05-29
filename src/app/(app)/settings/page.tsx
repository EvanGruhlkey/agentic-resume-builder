import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, GitHub connection, and preferences."
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          Settings will be added in a later step.
        </p>
      </div>
    </>
  );
}
