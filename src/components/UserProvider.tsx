"use client";
import { useEffect } from "react";
import { useUser } from "@/store/useUser";

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { fetchUser } = useUser();

  useEffect(() => {
    // Fetch user on app load to restore session
    fetchUser();
  }, [fetchUser]);

  return <>{children}</>;
}
