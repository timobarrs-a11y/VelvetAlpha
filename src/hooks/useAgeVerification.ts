import { useEffect, useState } from 'react';

export function useAgeVerification() {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verified = localStorage.getItem('ageVerified') === 'true';
    setIsVerified(verified);
    setIsLoading(false);
  }, []);

  return { isVerified, isLoading, setIsVerified };
}
