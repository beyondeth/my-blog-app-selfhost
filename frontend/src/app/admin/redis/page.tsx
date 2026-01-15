'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Activity,
  Lock,
  Shield,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Unlock,
  TrendingUp,
  TrendingDown,
  Server,
  HardDrive,
  Clock,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface RedisInfo {
  usedMemory: string;
  usedMemoryHuman: string;
  usedMemoryPeak: string;
  usedMemoryPeakHuman: string;
  memoryFragmentation: number;
  connectedClients: number;
  totalKeys: number;
  uptime: number;
}

interface KeyPattern {
  pattern: string;
  count: number;
  percentage: number;
}

interface Lock {
  resource: string;
  ttl: number;
  locked: boolean;
}

interface RateLimitStatus {
  blockedIPs: Array<{
    ip: string;
    apiKeyId: string;
    blockedUntil: string;
    remainingTime: number;
  }>;
  apiKeyUsage: Array<{
    apiKeyId: string;
    minuteCount: number;
    hourCount: number;
    dayCount: number;
  }>;
}

export default function RedisMonitoringPage() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [redisInfo, setRedisInfo] = useState<RedisInfo | null>(null);
  const [keyPatterns, setKeyPatterns] = useState<KeyPattern[]>([]);
  const [locks, setLocks] = useState<Lock[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletePattern, setDeletePattern] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [releasingLock, setReleasingLock] = useState<string | null>(null);
  const [unblockingIP, setUnblockingIP] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      const headers = {
        'Content-Type': 'application/json',
      };

      const [queueRes, infoRes, patternsRes, locksRes, rateLimitsRes] = await Promise.all([
        fetch(`${API_URL}/redis/queues/status`, { credentials: 'include', headers }),
        fetch(`${API_URL}/redis/info`, { credentials: 'include', headers }),
        fetch(`${API_URL}/redis/keys/patterns`, { credentials: 'include', headers }),
        fetch(`${API_URL}/redis/locks`, { credentials: 'include', headers }),
        fetch(`${API_URL}/redis/rate-limits`, { credentials: 'include', headers }),
      ]);

      if (queueRes.ok) setQueueStats(await queueRes.json());
      if (infoRes.ok) setRedisInfo(await infoRes.json());
      if (patternsRes.ok) setKeyPatterns(await patternsRes.json());
      if (locksRes.ok) setLocks(await locksRes.json());
      if (rateLimitsRes.ok) setRateLimits(await rateLimitsRes.json());

    } catch (error) {
      console.error('Failed to fetch Redis data:', error);
      toast.error('Failed to load Redis monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getMemoryUsagePercent = () => {
    if (!redisInfo) return 0;
    const used = parseInt(redisInfo.usedMemory);
    const max = 256 * 1024 * 1024; // 256MB in bytes
    return Math.round((used / max) * 100);
  };

  const handleReleaseLock = async (resource: string) => {
    try {
      setReleasingLock(resource);
      const response = await fetch(`${API_URL}/redis/locks/${resource}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success(`Lock released: ${resource}`);
        fetchData();
      } else {
        toast.error('Failed to release lock');
      }
    } catch (error) {
      toast.error('Error releasing lock');
    } finally {
      setReleasingLock(null);
    }
  };

  const handleUnblockIP = async (ip: string, apiKeyId: string) => {
    try {
      setUnblockingIP(`${ip}:${apiKeyId}`);
      const response = await fetch(`${API_URL}/redis/unblock-ip`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, apiKeyId }),
      });

      if (response.ok) {
        toast.success(`IP unblocked: ${ip}`);
        fetchData();
      } else {
        toast.error('Failed to unblock IP');
      }
    } catch (error) {
      toast.error('Error unblocking IP');
    } finally {
      setUnblockingIP(null);
    }
  };

  const getQueueColor = (type: string, value: number, total: number) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    switch(type) {
      case 'completed': return 'bg-secondary';
      case 'active': return 'bg-primary';
      case 'waiting': return 'bg-muted';
      case 'failed': return 'bg-destructive';
      case 'delayed': return 'bg-accent';
      case 'paused': return 'bg-muted-foreground';
      default: return 'bg-border';
    }
  };

  const getPatternColor = (pattern: string) => {
    switch(pattern) {
      case 'cache:': return 'bg-primary';
      case 'bull:': return 'bg-secondary';
      case 'lock:': return 'bg-muted';
      case 'mcp:': return 'bg-accent';
      default: return 'bg-border';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Database className="h-12 w-12 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading Redis monitoring data...</p>
        </div>
      </div>
    );
  }

  const totalQueueJobs = queueStats ?
    queueStats.waiting + queueStats.active + queueStats.completed +
    queueStats.failed + queueStats.delayed + queueStats.paused : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Redis Monitoring</h1>
        <Button
          onClick={fetchData}
          disabled={refreshing}
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Redis Server Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <HardDrive className="h-8 w-8 text-blue-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{redisInfo?.usedMemoryHuman || '0B'}</p>
                <p className="text-xs text-gray-500">of 256MB</p>
                <Progress value={getMemoryUsagePercent()} className="mt-2 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Database className="h-8 w-8 text-green-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{redisInfo?.totalKeys || 0}</p>
                <p className="text-xs text-gray-500">keys stored</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Connected Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-purple-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{redisInfo?.connectedClients || 0}</p>
                <p className="text-xs text-gray-500">active connections</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div className="text-right">
                <p className="text-xl font-bold">
                  {redisInfo ? formatUptime(redisInfo.uptime) : '0d 0h 0m'}
                </p>
                <p className="text-xs text-gray-500">server uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Stats and Key Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BullMQ Queue Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              BullMQ Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queueStats ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  {Object.entries(queueStats).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{value}</span>
                        <div className="w-20">
                          <Progress
                            value={totalQueueJobs > 0 ? (value / totalQueueJobs) * 100 : 0}
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 text-right">
                  Total Jobs: {totalQueueJobs}
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No queue data available</p>
            )}
          </CardContent>
        </Card>

        {/* Key Patterns Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Key Distribution by Pattern
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keyPatterns.map((pattern) => (
                <div key={pattern.pattern} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-mono">{pattern.pattern}</span>
                    <span>{pattern.count} ({pattern.percentage}%)</span>
                  </div>
                  <Progress
                    value={pattern.percentage}
                    className={`h-2 ${getPatternColor(pattern.pattern)}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distributed Locks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Distributed Locks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">TTL (seconds)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {locks.map((lock) => (
                    <tr key={lock.resource}>
                      <td className="px-4 py-2 text-sm font-mono">{lock.resource}</td>
                      <td className="px-4 py-2 text-sm">{lock.ttl > 0 ? lock.ttl : 'Expired'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          lock.locked ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground'
                        }`}>
                          {lock.locked ? 'Locked' : 'Released'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReleaseLock(lock.resource)}
                          disabled={!lock.locked || releasingLock === lock.resource}
                        >
                          <Unlock className="h-3 w-3 mr-1" />
                          Release
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No active locks</p>
          )}
        </CardContent>
      </Card>

      {/* Rate Limiting Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blocked IPs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Blocked IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rateLimits?.blockedIPs && rateLimits.blockedIPs.length > 0 ? (
              <div className="space-y-2">
                {rateLimits.blockedIPs.map((blocked) => (
                  <div key={`${blocked.ip}:${blocked.apiKeyId}`}
                       className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <div>
                      <p className="text-sm font-mono">{blocked.ip}</p>
                      <p className="text-xs text-gray-500">
                        Unblocks in {Math.floor(blocked.remainingTime / 60)}m {blocked.remainingTime % 60}s
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnblockIP(blocked.ip, blocked.apiKeyId)}
                      disabled={unblockingIP === `${blocked.ip}:${blocked.apiKeyId}`}
                    >
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No blocked IPs</p>
            )}
          </CardContent>
        </Card>

        {/* API Key Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              API Key Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rateLimits?.apiKeyUsage && rateLimits.apiKeyUsage.length > 0 ? (
              <div className="space-y-3">
                {rateLimits.apiKeyUsage.map((usage) => (
                  <div key={usage.apiKeyId} className="border-b pb-2">
                    <p className="text-sm font-mono mb-1">{usage.apiKeyId}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Minute:</span>
                        <span className="ml-1 font-medium">{usage.minuteCount}/3</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Hour:</span>
                        <span className="ml-1 font-medium">{usage.hourCount}/10</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Day:</span>
                        <span className="ml-1 font-medium">{usage.dayCount}/10</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No API key usage data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}