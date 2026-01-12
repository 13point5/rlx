"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { ChevronsUpDown, LogOut, Settings, Zap } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: {
    src: string;
    alt: string;
    rounded?: "full" | "sm";
  };
  items?: {
    label: string;
    href: string;
    active?: boolean;
    icon?: { src: string; alt: string; rounded?: "full" | "sm" };
  }[];
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  isLoading?: boolean;
}

export function AppHeader({ breadcrumbs = [], isLoading = false }: AppHeaderProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-14 items-center px-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2">
          <Zap className="size-5 fill-current" />
          <span className="font-semibold hidden sm:inline">RLX</span>
        </Link>

        {/* Breadcrumbs */}
        {isLoading ? (
          <div className="flex items-center text-sm">
            <span className="mx-3 text-muted-foreground/50">/</span>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : breadcrumbs.length > 0 ? (
          <nav className="flex items-center text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                <span className="mx-3 text-muted-foreground/50">/</span>
                {crumb.items ? (
                  <div className="flex items-center gap-1">
                    {crumb.icon && (
                      <Image
                        src={crumb.icon.src}
                        alt={crumb.icon.alt}
                        width={16}
                        height={16}
                        className={crumb.icon.rounded === "full" ? "rounded-full" : "rounded-sm"}
                      />
                    )}
                    <span className="font-medium">{crumb.label}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                        >
                          <ChevronsUpDown className="size-3 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {crumb.items.map((item) => (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link
                              href={item.href}
                              className={`flex items-center gap-2 ${item.active ? "font-medium" : ""}`}
                            >
                              {item.icon && (
                                <Image
                                  src={item.icon.src}
                                  alt={item.icon.alt}
                                  width={16}
                                  height={16}
                                  className={item.icon.rounded === "full" ? "rounded-full" : "rounded-sm"}
                                />
                              )}
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="px-2 py-1 text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="px-2 py-1 font-medium">{crumb.label}</span>
                )}
              </div>
            ))}
          </nav>
        ) : null}

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
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
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
