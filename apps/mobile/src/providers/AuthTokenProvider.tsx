import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { setAuthTokenGetter } from '../services/api';

type Props = {
  children: React.ReactNode;
};

export function AuthTokenProvider({ children }: Props) {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return <>{children}</>;
}
