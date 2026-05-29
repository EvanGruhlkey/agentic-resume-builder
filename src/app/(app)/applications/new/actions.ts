"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createApplicationPacket } from "@/lib/storage/application-packet";
import { createJobPosting } from "@/lib/storage/job-posting";
import { getMasterResume } from "@/lib/storage/master-resume";

export type CreateApplicationState = {
  error: string;
} | null;

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createApplication(
  _prev: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const company = String(formData.get("company") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const applicationUrl = emptyToNull(
    String(formData.get("applicationUrl") ?? ""),
  );
  const masterResumeId = String(formData.get("masterResumeId") ?? "").trim();

  if (!company) {
    return { error: "Company name is required." };
  }
  if (!title) {
    return { error: "Role title is required." };
  }
  if (!description) {
    return { error: "Job description is required." };
  }
  if (!masterResumeId) {
    return { error: "Select a master resume." };
  }

  const resume = await getMasterResume(masterResumeId);
  if (!resume) {
    return { error: "Selected master resume was not found." };
  }

  const job = await createJobPosting({
    company,
    title,
    location: null,
    description,
    requirements: [],
    niceToHaves: [],
    applicationUrl,
    sourceUrl: null,
  });

  const packet = await createApplicationPacket({
    jobPostingId: job.id,
    masterResumeId: resume.id,
    status: "draft",
  });

  revalidatePath("/dashboard");
  revalidatePath("/applications");
  redirect(`/applications/${packet.id}`);
}
