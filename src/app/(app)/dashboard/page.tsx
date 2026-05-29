import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your resume, evidence sources, and application packets."
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          Dashboard content will be added in a later step.
        </p>
      </div>
    </>
  );
}
