import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthLayoutContent } from "./layout-content";

export default async function AuthLayout({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <AuthLayoutContent breadcrumbs={breadcrumbs}>
      {children}
    </AuthLayoutContent>
  );
}
