import { LoginForm } from "@/components/login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return <LoginForm next={(await searchParams).next} />;
}
