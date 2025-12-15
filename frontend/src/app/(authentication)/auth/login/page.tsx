import { Suspense } from 'react'
import LoginForm from "./_components/form"
const LoginPage = async () => {
    return <>
        <Suspense>
            <LoginForm />

        </Suspense>
    </>
}

export default LoginPage;