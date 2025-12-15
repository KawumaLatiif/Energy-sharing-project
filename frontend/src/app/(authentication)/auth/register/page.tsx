import { Suspense } from 'react'
import RegisterForm from './_components/form';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';



const RegistrationPage = async ({params}: {params: any}) => {


    return <>
         <Suspense fallback={<div>Server error</div>}>
            <RegisterForm />

            <div className="sm:mx-auto sm:w-full sm:max-w-md flex justify-center items-center">
                <Link className="text-white inline-flex" href="/auth/login"><span>Login</span> <ChevronRight /></Link>
            </div>

        </Suspense>
    </>
}

export default RegistrationPage;