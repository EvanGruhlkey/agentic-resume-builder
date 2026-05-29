"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createApplication,
  type CreateApplicationState,
} from "@/app/(app)/applications/new/actions";
import type { MasterResume } from "@/lib/types";

export function NewApplicationForm({
  masterResumes,
}: {
  masterResumes: MasterResume[];
}) {
  const [state, formAction, pending] = useActionState(
    createApplication,
    null as CreateApplicationState,
  );

  if (masterResumes.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">Master resume required</p>
        <p className="mt-1">
          Create your LaTeX master resume before starting an application.{" "}
          <Link
            href="/resume"
            className="font-medium underline-offset-2 hover:underline"
          >
            Set up resume
          </Link>
        </p>
      </div>
    );
  }

  const defaultResumeId = masterResumes[0].id;

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="company"
            className="block text-sm font-medium text-zinc-900"
          >
            Company
          </label>
          <input
            id="company"
            name="company"
            type="text"
            required
            autoComplete="organization"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-zinc-900"
          >
            Role title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="applicationUrl"
          className="block text-sm font-medium text-zinc-900"
        >
          Application URL
          <span className="ml-1 font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="applicationUrl"
          name="applicationUrl"
          type="url"
          placeholder="https://..."
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      <div>
        <label
          htmlFor="masterResumeId"
          className="block text-sm font-medium text-zinc-900"
        >
          Master resume
        </label>
        <select
          id="masterResumeId"
          name="masterResumeId"
          required
          defaultValue={defaultResumeId}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {masterResumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-900"
        >
          Job description
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Paste the full posting. Requirements parsing comes in a later step.
        </p>
        <textarea
          id="description"
          name="description"
          rows={14}
          required
          placeholder="Paste the job description here..."
          className="mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create application packet"}
        </button>
        <Link
          href="/applications"
          className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
