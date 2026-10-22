import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Router } from './Router.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AuthProvider } from './auth/AuthProvider';
import { CustomizationProvider } from './context/CustomizationContext';
import { monitoringService } from './services/monitoringService';
import { registerSW, installChunkErrorRecovery } from './services/swRegistration';
import './index.css';
import './design/design-system.css';
import { initDesignVariant } from './design/designSystem';

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

initDesignVariant();
installChunkErrorRecovery();
registerSW();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CustomizationProvider>
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
      </CustomizationProvider>
    </AuthProvider>
  </StrictMode>
);
