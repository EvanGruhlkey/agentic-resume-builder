import { PageHeader } from "@/components/page-header";

export default function NewApplicationPage() {
  return (
    <>
      <PageHeader
        title="New application"
        description="Paste a job description and create a tailored resume packet."
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          Application creation form will be added in a later step.
        </p>
      </div>
    </>
  );
}
