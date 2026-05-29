import { PageHeader } from "@/components/page-header";

export default function ResumePage() {
  return (
    <>
      <PageHeader
        title="Master resume"
        description="Your canonical LaTeX resume used as the source of truth for tailoring."
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          LaTeX editor and metadata will be added in a later step.
        </p>
      </div>
    </>
  );
}
