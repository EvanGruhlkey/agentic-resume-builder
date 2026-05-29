import { PageHeader } from "@/components/page-header";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title="Application packet"
        description={`Packet ID: ${id}`}
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          Fit score, change log, and tailored resume will be added in a later
          step.
        </p>
      </div>
    </>
  );
}
