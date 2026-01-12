import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { AuthLayoutContent } from "./layout-content";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <BreadcrumbProvider>
      <AuthLayoutContent>{children}</AuthLayoutContent>
    </BreadcrumbProvider>
  );
}
