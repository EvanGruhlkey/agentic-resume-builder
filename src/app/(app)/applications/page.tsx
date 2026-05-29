import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader
        title="Applications"
        description="Tailored resume packets for each job you are targeting."
        actions={
          <Link
            href="/applications/new"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New application
          </Link>
        }
      />
      <div className="px-6 py-6">
        <p className="text-sm text-zinc-600">
          Application list will be added in a later step.
        </p>
      </div>
    </>
  );
}
