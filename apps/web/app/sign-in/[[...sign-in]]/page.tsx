import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-4">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg rounded-xl border bg-card",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton:
              "bg-background border hover:bg-accent text-foreground",
            formFieldLabel: "text-foreground",
            formFieldInput:
              "bg-background border-input text-foreground focus:ring-ring",
            footerActionLink: "text-primary hover:text-primary/80",
            formButtonPrimary:
              "bg-primary text-primary-foreground hover:bg-primary/90",
            identityPreviewEditButton: "text-primary hover:text-primary/80",
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/home"
      />
    </div>
  );
}
