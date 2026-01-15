import { useCallback, useState } from 'react';
import type { McpApiKey } from '@/services/api/mcp.service';
import { listMcpApiKeys } from '@/services/api/mcp.service';

export function useMcpApiKeys() {
  const [keys, setKeys] = useState<McpApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMcpApiKeys();
      setKeys(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeKeyLocally = useCallback((keyId: string) => {
    setKeys(prev => prev.filter(key => key.id !== keyId));
  }, []);

  return {
    keys,
    loading,
    refreshKeys,
    removeKeyLocally,
  };
}
