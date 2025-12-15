"use client"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState, useTransition } from "react";
import 'react-phone-number-input/style.css'
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
import { createAccountSchema, LoginSchema } from "@/lib/schema";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import createAccount from "../register";
import { useSearchParams } from "next/navigation";
import CardWrapper from "@/components/common/card-wrapper";
import Link from "next/link";
import CountrySelect from "@/components/common/country-select";
import { cn } from "@/lib/utils";
import { useRouter } from 'next/navigation';




export default function RegisterForm() {

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState<{ value: string, label: string } | null>(null);


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


  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof createAccountSchema>) {
    setIsSubmitting(true);
    setError('');
    console.log("posting form data: ", values)
    startTransition(async () => {
      createAccount(values).then((data) => {
        if (data?.error) {

          if (typeof data.error === "object") {
            if (data.error?.email) {
              form.setError("email", { type: 'custom', message: data.error?.email[0] })
            }

            if (data.error?.first_name) {
              form.setError("first_name", { type: 'custom', message: data.error?.first_name[0] })
            }

            if (data.error?.last_name) {
              form.setError("last_name", { type: 'custom', message: data.error?.last_name[0] })
            }


            if (data.error?.phone_number) {
              console.log("GOT PHONE ERROR: ", data.error?.phone_number)
              form.setError("phone_number", { type: 'custom', message: data.error?.phone_number[0] })
            }

            if (data.error?.password) {
              form.setError("password", { type: 'custom', message: data.error?.password[0] })
            }

            if (data.error?.confirm_password) {
              form.setError("confirm_password", { type: 'custom', message: data.error?.confirm_password[0] })
            }

          } else {
            setError(data.error);
          }
        }

        // if (data?.success) {
        //   form.reset();
        //   setSuccess(data.success);
        // }

        // if (data?.twoFactor) {
        //   setShowTwoFactor(true);
        // }
      }).catch(() => setError(""));

    })
    try {
      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (response.ok) {
        // Redirect to verification page on success
        router.push('/auth/verify-email?email=' + encodeURIComponent(values.email));
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error) {
      setError("User registered Successfully");
    } finally {
      setIsSubmitting(false);
    }
  }



  return (
    <>
      <CardWrapper title="Create an account">

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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

            <div className="mt-1">





            </div>




            <div className="flex flex-col space-y-1.5">

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem >
                    <FormLabel className="font-semibold">Phone number</FormLabel>
                    <FormControl>
                      <PhoneInput
                        // className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground  disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}

                        inputComponent={ShadIput}
                      // inputComponent={React.forwardRef((ref) => <Input  type="tel" placeholder="Enter phone number"  {...field} />)}
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




            <div className="flex items-center justify-between">
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
          {/* {error && <div className="error-message">{error}</div>} */}
          {/* <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Registering...' : 'Register'}
          </button> */}
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
