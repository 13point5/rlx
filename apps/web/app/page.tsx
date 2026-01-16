import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import { Zap, GitBranch, Cpu, BarChart3 } from "lucide-react";

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center border border-border bg-card">
              <Zap className="size-4" />
            </div>
            <span className="text-foreground-bright">RLX</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {userId ? (
              <Button asChild size="sm" className="sm:h-10 sm:px-4">
                <Link href="/home">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild size="sm" className="sm:h-10 sm:px-4">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="sm:h-10 sm:px-4">
                  <Link href="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center gap-8 px-4 py-24 text-center md:py-32">
          <div className="flex max-w-3xl flex-col items-center gap-6">
            <div className="border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              Reinforcement Learning Made Simple
            </div>
            <h1 className="text-4xl tracking-tight text-foreground-bright md:text-5xl lg:text-6xl">
              Train RL Models with
              <span className="text-foreground"> One Click</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
              Connect your GitHub repo, select a config, pick a GPU, and start training.
              No infrastructure headaches. Just results.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href={userId ? "/home" : "/sign-up"}>
                  Get Started Free
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="https://github.com" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="mb-12 text-center">
              <h2 className="text-2xl tracking-wide text-foreground-bright uppercase">
                Everything you need for RL training
              </h2>
              <p className="mt-4 text-muted-foreground">
                From code to trained model in minutes, not hours.
              </p>
            </div>
            {/* Feature cards in bordered panel style */}
            <div className="border border-border mx-auto max-w-4xl">
              <FeatureRow
                icon={GitBranch}
                title="GitHub Integration"
                description="Connect your repos and select any branch or config file directly."
                isLast={false}
              />
              <FeatureRow
                icon={Cpu}
                title="GPU Selection"
                description="Choose from H100s, A100s, and more. Spot or secure pricing."
                isLast={false}
              />
              <FeatureRow
                icon={BarChart3}
                title="Live Monitoring"
                description="Watch your training runs in real-time with detailed metrics."
                isLast={false}
              />
              <FeatureRow
                icon={Zap}
                title="Fast Spin-up"
                description="Get from zero to training in under 2 minutes."
                isLast={true}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 text-sm text-muted-foreground">
          <p>Built for the RL community</p>
          <p>Powered by Prime Intellect</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  description,
  isLast,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  isLast: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-4 py-4 ${!isLast ? "border-b border-border" : ""}`}>
      <div className="flex size-10 items-center justify-center border border-border bg-card shrink-0">
        <Icon className="size-5 text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-foreground-bright">{title}</h3>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
    </div>
  );
}
