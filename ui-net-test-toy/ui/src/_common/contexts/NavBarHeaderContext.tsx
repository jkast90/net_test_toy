import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavBarHeaderContextType {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
}

const NavBarHeaderContext = createContext<NavBarHeaderContextType | undefined>(undefined);

export function NavBarHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);

  return (
    <NavBarHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </NavBarHeaderContext.Provider>
  );
}

export function useNavBarHeader() {
  const context = useContext(NavBarHeaderContext);
  if (context === undefined) {
    throw new Error('useNavBarHeader must be used within a NavBarHeaderProvider');
  }
  return context;
}
