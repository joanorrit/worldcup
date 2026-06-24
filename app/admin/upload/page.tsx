import { put } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getSafeResultFileName,
  isResultFileName,
  MAX_RESULT_CSV_BYTES,
  RESULTS_BLOB_PREFIX,
  validateResultCsvContent,
} from '@/lib/result-files';

export const dynamic = 'force-dynamic';

interface UploadPageProps {
  searchParams?: {
    error?: string;
    uploaded?: string;
  };
}

interface UploadResult {
  ok: boolean;
  fileName?: string;
  message?: string;
}

export default function UploadPage({ searchParams }: UploadPageProps) {
  const uploaded = searchParams?.uploaded;
  const error = searchParams?.error;

  return (
    <main className="min-h-screen bg-[#EBE7E4] px-4 py-6 text-[#252F3D] sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[58rem]">
        <header className="max-w-[42rem] py-4 sm:py-6">
          <p className="inline-flex border border-[#8B847D59] px-2 py-1 font-mono text-[0.68rem] uppercase leading-none tracking-[0.12em] text-[#5C5752]">
            Admin
          </p>
          <h1 className="mt-4 font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal italic leading-[0.9] tracking-[-0.06em]">
            Upload results
          </h1>
          <p className="mt-4 text-[1rem] leading-[1.55] text-[#384251]/90">
            Upload a leaderboard result CSV named with the Resultats_YYYY_MM_DD.csv format.
            Uploaded files are stored in Vercel Blob and override committed files with the same name.
          </p>
        </header>

        <section className="border border-[#8B847D59] bg-[#F4F2F0] p-5 sm:p-7">
          {uploaded ? (
            <StatusMessage tone="success">
              Uploaded {uploaded}. The leaderboard will use this file on the next page load.
            </StatusMessage>
          ) : null}

          {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

          <form action={uploadResultCsv} className="mt-2 grid gap-5">
            <label className="grid gap-2 text-left">
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[#5C5752]">
                Admin token
              </span>
              <input
                className="h-11 border border-[#8B847D59] bg-[#FAFAF7] px-3 text-sm text-[#252F3D] outline-none transition focus:border-[#4B607C]"
                name="adminToken"
                required
                type="password"
              />
            </label>

            <label className="grid gap-2 text-left">
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-[#5C5752]">
                Result CSV
              </span>
              <input
                accept=".csv,text/csv"
                className="block w-full border border-[#8B847D59] bg-[#FAFAF7] px-3 py-2 text-sm text-[#252F3D] file:mr-4 file:border-0 file:bg-transparent file:font-mono file:text-[0.68rem] file:uppercase file:tracking-[0.12em] file:text-[#4B607C]"
                name="resultCsv"
                required
                type="file"
              />
            </label>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center border border-[#5C575280] bg-transparent px-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-[#252F3D] transition hover:border-[#252F3D] hover:bg-[#EBE7E4]"
                type="submit"
              >
                Upload CSV
              </button>
              <Link
                className="inline-flex h-10 items-center justify-center border border-[#8B847D59] px-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-[#5C5752] transition hover:border-[#5C575280] hover:bg-[#EBE7E4]"
                href="/"
              >
                Back to leaderboard
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function StatusMessage({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'error' | 'success';
}) {
  const className =
    tone === 'error'
      ? 'mb-4 border border-[#844F3B40] bg-[#844F3B0A] px-3 py-2 text-sm leading-[1.5] text-[#844F3B]'
      : 'mb-4 border border-[#6F8E7359] bg-[#A3A47312] px-3 py-2 text-sm leading-[1.5] text-[#3F6B49]';

  return <p className={className}>{children}</p>;
}

async function uploadResultCsv(formData: FormData) {
  'use server';

  const result = await processResultUpload(formData);

  if (!result.ok) {
    redirect(`/admin/upload?error=${encodeURIComponent(result.message ?? 'Upload failed.')}`);
  }

  revalidatePath('/');
  redirect(`/admin/upload?uploaded=${encodeURIComponent(result.fileName ?? '')}`);
}

async function processResultUpload(formData: FormData): Promise<UploadResult> {
  const configuredAdminToken = process.env.ADMIN_UPLOAD_TOKEN;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!configuredAdminToken) {
    return { ok: false, message: 'Admin upload is not configured.' };
  }

  if (!blobToken) {
    return { ok: false, message: 'Blob storage is not configured.' };
  }

  const submittedToken = String(formData.get('adminToken') ?? '');

  if (submittedToken !== configuredAdminToken) {
    return { ok: false, message: 'Invalid admin token.' };
  }

  const uploadedFile = formData.get('resultCsv');

  if (!isUploadedFile(uploadedFile)) {
    return { ok: false, message: 'Choose a CSV file to upload.' };
  }

  const fileName = getSafeResultFileName(uploadedFile.name);

  if (!isResultFileName(fileName)) {
    return { ok: false, message: 'The file name must match Resultats_YYYY_MM_DD.csv.' };
  }

  if (uploadedFile.size > MAX_RESULT_CSV_BYTES) {
    return { ok: false, message: 'The CSV file is too large.' };
  }

  const content = await uploadedFile.text();
  const validationError = validateResultCsvContent(content);

  if (validationError) {
    return { ok: false, message: validationError };
  }

  await put(`${RESULTS_BLOB_PREFIX}${fileName}`, content, {
    access: 'public',
    allowOverwrite: true,
    contentType: 'text/csv; charset=utf-8',
    token: blobToken,
  });

  return { ok: true, fileName };
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'size' in value &&
    'text' in value &&
    typeof value.text === 'function'
  );
}
