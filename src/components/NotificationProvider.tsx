"use client";
import { useEffect } from "react";
import { notifications } from "@/lib/notifications";
import { useUser } from "@/store/useUser";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    // Initialize notifications when user is logged in
    if (user) {
      notifications.initialize().then((success) => {
        if (success) {
          console.log('✓ Notifications initialized');
        }
      });
    }
  }, [user]);

  return <>{children}</>;
}
