'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@/lib/auth';

export default function AdminTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const testAdminAccess = async () => {
      try {
        console.log('🔍 Testing direct admin access...');
        
        // Test 1: Direct admin dashboard call
        const res = await authFetch('http://localhost:8000/api/v1/admin/dashboard/');
        
        console.log('📊 Admin Dashboard Status:', res.status);
        
        if (res.status === 200) {
          const data = await res.json();
          console.log('✅ Admin Dashboard Data:', data);
          setResult({ success: true, data });
          
          // If successful, redirect to admin dashboard
          setTimeout(() => {
            router.push('/admin/dashboard');
          }, 2000);
        } else {
          console.log('❌ Admin access denied');
          setResult({ success: false, status: res.status });
          
          // Redirect to regular dashboard
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        }
      } catch (error) {
        console.error('❌ Error testing admin access:', error);
        setResult({ success: false, error });
      } finally {
        setLoading(false);
      }
    };

    testAdminAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Testing admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Admin Access Test</h1>
        
        {result?.success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 text-green-700 rounded">
              <h2 className="font-bold">✅ Admin Access Granted!</h2>
              <p>Redirecting to admin dashboard...</p>
            </div>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="p-4 bg-red-50 text-red-700 rounded">
            <h2 className="font-bold">❌ Admin Access Denied</h2>
            <p>Status: {result?.status || 'Error'}</p>
            <p>Redirecting to user dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}