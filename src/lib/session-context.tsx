"use client";

import { createContext, useContext, type ReactNode } from "react";

type SessionContextValue = {
  loggedIn: boolean;
};

const SessionContext = createContext<SessionContextValue>({ loggedIn: false });

export function SessionProvider({
  loggedIn,
  children,
}: {
  loggedIn: boolean;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={{ loggedIn }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
