import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user.firstName ? `, ${user.firstName}` : ""}!
        </h1>
        <p className="text-muted-foreground">
          You&apos;re signed in as {user.emailAddresses[0]?.emailAddress}
        </p>
      </div>
    </div>
  );
}
