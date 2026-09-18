"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { useSession } from "@/lib/session-context";
import { logout } from "@/lib/auth-actions";
import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const needsLogin = !loggedIn && pathname !== "/login";
  const needsHome = loggedIn && pathname === "/login";

  useEffect(() => {
    if (needsLogin) router.replace("/login");
    if (needsHome) router.replace("/");
  }, [needsLogin, needsHome, router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  if (needsLogin || needsHome) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  return (
    <>
      {loggedIn && (
        <button
          type="button"
          onClick={handleLogout}
          className="fixed right-4 top-4 z-50 rounded-full bg-background p-2 text-muted-foreground shadow-sm ring-1 ring-border"
          aria-label="로그아웃"
        >
          <LogOutIcon className="size-4" />
        </button>
      )}
      <div className="flex-1 pb-16">{children}</div>
      {loggedIn && <BottomNav />}
    </>
  );
}
