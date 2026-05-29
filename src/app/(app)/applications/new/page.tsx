import { NewApplicationForm } from "@/components/applications/new-application-form";
import { PageHeader } from "@/components/page-header";
import { listMasterResumes } from "@/lib/storage";

export default async function NewApplicationPage() {
  const masterResumes = await listMasterResumes();

  return (
    <>
      <PageHeader
        title="New application"
        description="Paste a job description and create a tailored resume packet."
      />
      <div className="px-6 py-6">
        <NewApplicationForm masterResumes={masterResumes} />
      </div>
    </>
  );
}
