"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { useRegister } from "@/lib/hooks/use-auth";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/auth";
import { ClientApiError } from "@/lib/api/client";

export function RegisterForm() {
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (values: RegisterFormValues) => {
    registerUser.mutate(values);
  };

  const formLevelError =
    registerUser.error instanceof ClientApiError && !registerUser.error.fieldErrors
      ? registerUser.error.message
      : registerUser.isError
        ? "Unable to create account. Please try again."
        : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <AuthFormError message={formLevelError} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={registerUser.isPending}>
        {registerUser.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
