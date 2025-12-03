// src/components/AppProviders.tsx
// Simplified App Providers - most functionality moved to Redux
import { ReactNode } from "react";
import { ReduxAuthProvider } from "../../auth/components/ReduxAuthProvider";
import { ConfigProvider } from "../contexts/ConfigContext";
import { NavBarHeaderProvider } from "../contexts/NavBarHeaderContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider>
      <NavBarHeaderProvider>
        <ReduxAuthProvider>{children}</ReduxAuthProvider>
      </NavBarHeaderProvider>
    </ConfigProvider>
  );
}
