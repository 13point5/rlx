"use client";

import { createContext, useContext, useState, useCallback } from "react";

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

interface BreadcrumbContextType {
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(
  undefined
);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs, isLoading, setIsLoading }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  }
  return context;
}
