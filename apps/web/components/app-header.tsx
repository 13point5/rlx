"use client";

import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { LogOut, Settings, Zap, ChevronRight } from "lucide-react";

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

interface AppHeaderProps {
  breadcrumbs?: React.ReactNode;
}

export function AppHeader({ breadcrumbs }: AppHeaderProps) {
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
        {breadcrumbs && (
          <div className="ml-3 flex items-center gap-2 text-sm">
            <ChevronRight className="size-4 text-muted-foreground" />
            {breadcrumbs}
          </div>
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
