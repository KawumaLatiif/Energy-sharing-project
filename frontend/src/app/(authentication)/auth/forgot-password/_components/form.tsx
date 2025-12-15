"use client"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import {  useEffect, useState, useTransition } from "react";
import 'react-phone-number-input/style.css'   
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/anim/input";
import { createAccountSchema, LoginSchema, ForgotPasswordSchema } from "@/lib/schema";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { useSearchParams } from "next/navigation";
import CardWrapper from "@/components/common/card-wrapper";

import { cn } from "@/lib/utils";
import forgotPassword from "../forgot-password";



export default function ForgotPasswordForm() {

      
      const [error, setError] = useState<string | undefined>("");
      const [success, setSuccess] = useState("");
      const [isPending, startTransition] = useTransition();


      const form = useForm<z.infer<typeof ForgotPasswordSchema>>({
          resolver: zodResolver(ForgotPasswordSchema),
          defaultValues: {
              email: ""
          },
      });


      // 2. Define a submit handler.
      async function onSubmit(values: z.infer<typeof ForgotPasswordSchema>) {
        setError("");
        setSuccess("");
        console.log("posting form data: ", values)
        startTransition(async () => {

        

            forgotPassword(values).then((data) => {
              console.log("Responded with: ", data)
            if (data?.error) {
              console.log("Errorrunning")
              if(typeof data.error === "object"){
               
                if(data.error?.email){
                  form.setError("email", { type: 'custom', message: data.error?.email[0] })
                }
              } else {
                setError(data.error);
              }
            }
  
            // if (data?.success) {
            //   form.reset();
            //   setSuccess(data.success);
            // }
  
          }).catch(() => setError(""));

        })
      }

   
    return (
      <>
          <CardWrapper title="Forgot password">
          
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                  <div className="mt-1">
                    <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                  <Input disabled={isPending}  type="email" autoComplete="email" placeholder="email" {...field} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                          />
                    
                    </div>


                <FormError message={error} />

                <FormSuccess message={success} />

                <div>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full text-white dark:text-gray-900 bg-teal-800 dark:bg-white"
                  >
                   Send
                  </Button>
                </div>
              </form>
              </Form>
  
          </CardWrapper>
          {/* <SignIn /> */}
      </>
    )
  }

  const LabelInputContainer = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    return (
      <div className={cn("flex flex-col space-y-2 w-full", className)}>
        {children}
      </div>
    );
  };
  