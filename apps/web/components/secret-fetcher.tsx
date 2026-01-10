"use client";

import { useState } from "react";
import { getSecretFromAPI } from "@/app/actions/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Lock, Unlock } from "lucide-react";

export function SecretFetcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    data?: {
      secret: string;
      user_id: string;
      message: string;
    };
    error?: string;
  } | null>(null);

  const handleFetchSecret = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await getSecretFromAPI();
      setResult(response);
    } catch {
      setResult({ success: false, error: "Failed to fetch secret" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Backend Auth Test
        </CardTitle>
        <CardDescription>
          Test the protected Python API endpoint using your Clerk session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleFetchSecret}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Fetch Secret from API
            </>
          )}
        </Button>

        {result && (
          <div
            className={`rounded-lg p-4 ${
              result.success
                ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
            }`}
          >
            {result.success && result.data ? (
              <div className="space-y-2">
                <p className="font-medium text-green-800 dark:text-green-200">
                  ✅ Success!
                </p>
                <p className="text-2xl">{result.data.secret}</p>
                <p className="text-sm text-muted-foreground">
                  {result.data.message}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  User ID: {result.data.user_id}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  ❌ Error
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {result.error}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
