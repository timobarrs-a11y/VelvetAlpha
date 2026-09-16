import { createContext, useContext, useCallback, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface TransitionConfig {
  icon: LucideIcon;
  label: string;
  accentColor: string;
  bgColor?: string;
}

interface NavigationLoadingContextValue {
  navigateTo: (path: string, config: TransitionConfig) => void;
  clearTransition: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const navigateTo = useCallback((path: string, _cfg: TransitionConfig) => {
    navigate(path);
  }, [navigate]);

  const clearTransition = useCallback(() => {}, []);

  return (
    <NavigationLoadingContext.Provider value={{ navigateTo, clearTransition }}>
      {children}
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) throw new Error('useNavigationLoading must be used within NavigationLoadingProvider');
  return ctx;
}
