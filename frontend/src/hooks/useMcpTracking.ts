import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  McpStats, 
  McpActivity, 
  McpClientStats, 
  McpPopularPost, 
  McpHourlyActivity,
  McpUserActivity,
  McpFilters,
  AIClientType,
} from '@/types/mcp';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Fetch MCP Stats
export const useMcpStats = (days: number = 7) => {
  return useQuery<McpStats>({
    queryKey: ['mcp-stats', days],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/monitoring/mcp/stats?days=${days}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch MCP stats');
      }
      
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
};

// Fetch MCP Stats by Client
export const useMcpStatsByClient = (clientType?: AIClientType) => {
  return useQuery<McpClientStats>({
    queryKey: ['mcp-stats-by-client', clientType],
    queryFn: async () => {
      const params = clientType ? `?clientType=${clientType}` : '';
      const response = await fetch(`${API_URL}/monitoring/mcp/stats/by-client${params}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch MCP stats by client');
      }
      
      return response.json();
    },
    enabled: !!clientType,
  });
};

// Fetch Popular Posts
export const useMcpPopularPosts = (days: number = 7, limit: number = 10) => {
  return useQuery<McpPopularPost[]>({
    queryKey: ['mcp-popular-posts', days, limit],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/monitoring/mcp/popular-posts?days=${days}&limit=${limit}`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch popular posts');
      }
      
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });
};

// Fetch Hourly Activity
export const useMcpHourlyActivity = (hours: number = 24) => {
  return useQuery<McpHourlyActivity[]>({
    queryKey: ['mcp-hourly-activity', hours],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/monitoring/mcp/hourly-activity?hours=${hours}`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch hourly activity');
      }
      
      return response.json();
    },
    refetchInterval: 60000, // Auto-refresh every minute
  });
};

// Fetch User Activity
export const useMcpUserActivity = (userId: string, days: number = 7) => {
  return useQuery<McpUserActivity>({
    queryKey: ['mcp-user-activity', userId, days],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/monitoring/mcp/user-activity/${userId}?days=${days}`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch user activity');
      }
      
      return response.json();
    },
    enabled: !!userId,
  });
};

// Clean old logs
export const useMcpCleanLogs = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (days: number) => {
      const response = await fetch(`${API_URL}/monitoring/mcp/clean-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ days }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to clean logs');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all MCP queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['mcp-stats'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-hourly-activity'] });
      queryClient.invalidateQueries({ queryKey: ['mcp-popular-posts'] });
    },
  });
};

// Transform data for charts
export const transformStatsToChartData = (stats: McpStats) => {
  const clientData = stats?.byClient 
    ? Object.entries(stats.byClient).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        clientType: key as AIClientType,
      }))
    : [];

  const actionData = stats?.byAction
    ? Object.entries(stats.byAction).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        actionType: key,
      }))
    : [];

  return {
    clientData,
    actionData,
  };
};

// Transform hourly data for time series chart
export const transformHourlyToTimeSeries = (hourlyData: McpHourlyActivity[]) => {
  if (!hourlyData || !Array.isArray(hourlyData)) {
    return [];
  }
  
  return hourlyData.map(item => ({
    time: new Date(item.hour).toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    ...item.byClient,
    total: item.activities,
  }));
};

// Format large numbers
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

// Calculate percentage change
export const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
  if (previous === 0) return current > 0 ? 'up' : 'stable';
  
  const change = ((current - previous) / previous) * 100;
  
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'stable';
};