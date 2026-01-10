"use client";

import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { ChevronDown, LogOut, Settings, Zap } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface BreadcrumbItem {
  label: string;
  href?: string;
  items?: { label: string; href: string; active?: boolean }[];
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </div>
          <span className="font-semibold hidden sm:inline">RLX</span>
        </Link>

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-1">
                <span className="text-muted-foreground">/</span>
                {crumb.items ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
                        {crumb.label}
                        <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {crumb.items.map((item) => (
                        <DropdownMenuItem key={item.href} asChild>
                          <Link href={item.href} className={item.active ? "font-medium" : ""}>
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : crumb.href ? (
                  <Link href={crumb.href} className="px-2 py-1 hover:text-foreground text-muted-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="px-2 py-1 font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 rounded-full">
                  <Avatar className="size-7">
                    <AvatarImage src={user.imageUrl} alt={user.fullName ?? ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.emailAddresses[0]?.emailAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
