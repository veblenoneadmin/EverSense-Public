import { useState, useEffect } from 'react';

interface AuthConfig {
  googleOAuthEnabled: boolean;
  emailVerificationEnabled: boolean;
}

export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig>({
    googleOAuthEnabled: false,
    emailVerificationEnabled: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuthConfig = async () => {
      try {
        const response = await fetch('/api/auth-config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Failed to fetch auth config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuthConfig();
  }, []);

  return { config, loading };
}