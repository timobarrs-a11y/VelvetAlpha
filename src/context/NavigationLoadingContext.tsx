import { createContext, useContext, useState, useCallback, useEffect, type ReactNode, type LucideIcon } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';

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
  const location = useLocation();
  const [config, setConfig] = useState<TransitionConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const navigateTo = useCallback((path: string, cfg: TransitionConfig) => {
    setConfig(cfg);
    setVisible(true);
    requestAnimationFrame(() => {
      navigate(path);
    });
  }, [navigate]);

  const clearTransition = useCallback(() => {
    setVisible(false);
    setTimeout(() => setConfig(null), 200);
  }, []);

  useEffect(() => {
    if (visible) {
      const id = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setConfig(null), 200);
      }, 3500);
      return () => clearTimeout(id);
    }
  }, [visible, location.pathname]);

  return (
    <NavigationLoadingContext.Provider value={{ navigateTo, clearTransition }}>
      {children}
      {config && (
        <div
          className="fixed inset-0 z-[9999] transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'all' : 'none' }}
        >
          <FeatureLoadingSplash
            icon={config.icon}
            label={config.label}
            accentColor={config.accentColor}
            bgColor={config.bgColor}
          />
        </div>
      )}
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) throw new Error('useNavigationLoading must be used within NavigationLoadingProvider');
  return ctx;
}
