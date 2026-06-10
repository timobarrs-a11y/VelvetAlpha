import { createContext, useContext, useState, useCallback } from 'react';

interface ButtonHoverPreviewContextValue {
  previewStyle: string | null;
  setPreviewStyle: (style: string | null) => void;
}

const ButtonHoverPreviewContext = createContext<ButtonHoverPreviewContextValue>({
  previewStyle: null,
  setPreviewStyle: () => {},
});

export function ButtonHoverPreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewStyle, setPreviewStyleState] = useState<string | null>(null);

  const setPreviewStyle = useCallback((style: string | null) => {
    setPreviewStyleState(style);
  }, []);

  return (
    <ButtonHoverPreviewContext.Provider value={{ previewStyle, setPreviewStyle }}>
      {children}
    </ButtonHoverPreviewContext.Provider>
  );
}

export function useButtonHoverPreview() {
  return useContext(ButtonHoverPreviewContext);
}
