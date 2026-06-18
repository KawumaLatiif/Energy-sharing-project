"use client"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react";
// import 'react-phone-number-input/style.css'
import PhoneInput from 'react-phone-number-input'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/anim/input";
import { Input as ShadIput } from "@/components/ui/input";
import { createAccountSchema } from "@/lib/schema";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import createAccount from "../register";
import CardWrapper from "@/components/common/card-wrapper";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';
import { getApiErrorMessage } from "@/lib/api-response";


export default function RegisterForm() {

  const [error, setError] = useState('');
  const router = useRouter();
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [redirectNote, setRedirectNote] = useState("");

  const form = useForm<z.infer<typeof createAccountSchema>>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone_number: "",
      email: "",
      password: "",
      confirm_password: "",
      gender: "MALE",
    },
  });

  async function onSubmit(values: z.infer<typeof createAccountSchema>) {
    setError('');
    setSuccess("");
    setRedirectNote("");
    startTransition(async () => {
      const data = await createAccount(values);
      if (data?.error) {
        setError(getApiErrorMessage(data.error, "Registration failed"));
        return;
      }

      form.reset();
      const email = (data as any)?.email || values.email;
      setSuccess("Account created successfully.");
      setRedirectNote(`Verification link sent to ${email}. Redirecting to login…`);
      setTimeout(() => {
        router.push("/auth/login");
      }, 2500);
    });
  }

  return (
    <>
      <CardWrapper title="Create an account" variant="auth">

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5 sm:space-y-3">

            <div className="mt-1">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input disabled={isPending}
                        type="first_name" placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-1">
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input disabled={isPending}
                        type="last_name" placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-1">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input disabled={isPending}
                        type="email" autoComplete="email" placeholder="johndoe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Phone number</FormLabel>
                    <FormControl>
                      <PhoneInput
                        className="phone-input w-full"
                        {...field}
                        inputComponent={ShadIput}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MALE">
                          <div className="flex items-center gap-4 justify-between">
                            <span>Male</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="FEMALE">
                          <div className="flex items-center gap-4 justify-between">
                            <span>Female</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-1">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} type="password" autoComplete="password" placeholder="Password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-1">
              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} type="password" autoComplete="password" placeholder="Confirm password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link href="/auth/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <FormError message={error} />
            <FormSuccess message={success} />
            <FormSuccess message={redirectNote} />

            <div>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full text-white dark:text-gray-900 bg-sky-500 dark:bg-white"
              >
                Signup
              </Button>
            </div>
          </form>
        </Form>

      </CardWrapper>
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
