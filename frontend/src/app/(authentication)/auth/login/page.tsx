import { Suspense } from 'react'
import LoginForm from "./_components/form"
const LoginPage = async () => {
    return <div className="bg-gradient-to-br from-blue-50 via-emerald-50 to-blue-100 dark:from-blue-950 dark:via-emerald-900/20 dark:to-blue-900 py-12 sm:py-16 md:py-20 lg:py-24">
        <Suspense>
            <LoginForm />
        </Suspense>
    </div>
}

export default LoginPage;