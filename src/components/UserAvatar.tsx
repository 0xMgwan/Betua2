"use client";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  onClick?: (username: string) => void;
  className?: string;
}

const SIZES = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-12 h-12 text-lg",
  lg: "w-14 h-14 text-xl",
};

export function UserAvatar({ username, avatarUrl, size = "sm", onClick, className }: UserAvatarProps) {
  const sizeClass = SIZES[size];

  const avatar = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={username}
      className={cn(sizeClass, "rounded-full object-cover", onClick && "cursor-pointer", className)}
      onClick={() => onClick?.(username)}
    />
  ) : (
    <div
      className={cn(
        sizeClass,
        "rounded-full bg-gradient-to-br from-[#00e5a0] to-[#00b4d8] flex items-center justify-center text-black font-bold",
        onClick && "cursor-pointer",
        className
      )}
      onClick={() => onClick?.(username)}
    >
      {username[0]?.toUpperCase() || "?"}
    </div>
  );

  return avatar;
}
