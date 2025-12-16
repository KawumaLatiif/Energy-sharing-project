import { Suspense } from "react";
import { notFound } from "next/navigation"; 
import ResetPasswordForm from "./_components/form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; token?: string }>;
}) {
  const params = await searchParams;

  if (!params.uid || !params.token) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          Loading...
        </div>
      }
    >
      <ResetPasswordForm uid={params.uid} token={params.token} />
    </Suspense>
  );
}
