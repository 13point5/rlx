import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <AppShell>{children}</AppShell>;
}
