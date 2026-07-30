import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Router } from './Router.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { queryClient } from './shared/queryClient';
import { AuthProvider } from './auth/AuthProvider';
import { CustomizationProvider } from './context/CustomizationContext';
import { monitoringService } from './services/monitoringService';
import { registerSW, installChunkErrorRecovery } from './services/swRegistration';
import { useThemeStore } from './stores/themeStore';
import './index.css';

// Sync the theme store with the pre-paint boot script and start following the OS.
useThemeStore.getState().init();

window.addEventListener('unhandledrejection', (event) => {
  monitoringService.trackError({
    errorType: 'client_error',
    errorMessage: event.reason?.message ?? String(event.reason),
    errorStack: event.reason?.stack,
    severity: 'high',
    component: 'unhandledrejection',
  });
});

window.addEventListener('error', (event) => {
  if (event.error) {
    monitoringService.trackError({
      errorType: 'client_error',
      errorMessage: event.error.message ?? event.message,
      errorStack: event.error.stack,
      severity: 'high',
      component: `${event.filename ?? 'unknown'}:${event.lineno}`,
    });
  }
});

installChunkErrorRecovery();
registerSW();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CustomizationProvider>
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </CustomizationProvider>
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>
);
