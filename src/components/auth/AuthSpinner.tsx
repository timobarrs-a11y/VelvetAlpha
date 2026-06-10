export const AuthSpinner = () => (
  <div className="min-h-screen bg-surface-50 flex items-center justify-center">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-4 border-surface-200" />
      <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-t-primary-500 animate-spin" />
    </div>
  </div>
);
