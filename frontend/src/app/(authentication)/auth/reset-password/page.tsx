import { Suspense } from 'react';
import ResetPasswordForm from './_components/form';
export default async function ResetPasswordPage({ searchParams }: { searchParams: { uid: string; token: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordForm uid={searchParams.uid} token={searchParams.token} />
    </Suspense>
  );
}