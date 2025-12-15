import {get} from "@/lib/fetch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import ForgotPasswordForm from "./_components/form";

const ForgotPasswordPage = async () => {
    
    // const response = await get<{status_code?: number, error?: string, message?: string}>('auth/forgot-password/');
    return <div className="flex items-center justify-center">
        <div>
        {/* {response?.data?.message && <><Alert>
            {
            <AlertTitle>Success!</AlertTitle>
            <AlertDescription>
                {response?.data?.message}
            </AlertDescription>
        </Alert>
        <ForgotPasswordForm />
        </>} */}
        <ForgotPasswordForm />
        {/* {response?.error && <Alert variant={"destructive"}>
            
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>
                {response?.error?.message}
            </AlertDescription>
        </Alert>} */}
        </div>
    </div>
}

export default ForgotPasswordPage;