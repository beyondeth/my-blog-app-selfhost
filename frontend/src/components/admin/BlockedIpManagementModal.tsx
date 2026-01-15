import { useState, useEffect } from 'react';
import { defaultApiClient as api } from '@/lib/api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiX, FiShieldOff, FiTrash2, FiRefreshCw } from 'react-icons/fi';

interface BlockedIp {
  id: string;
  ipAddress: string; // Encrypted/Masked
  originalIp: string; // Decrypted
  reason: string;
  blockedBy: string;
  createdAt: string;
}

interface BlockedIpManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BlockedIpManagementModal({ isOpen, onClose }: BlockedIpManagementModalProps) {
  const [ips, setIps] = useState<BlockedIp[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBlockedIps = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<BlockedIp[]>('/moderation/blocked-ips');
      setIps(data);
    } catch (error) {
      console.error('Failed to fetch blocked IPs', error);
      alert('차단된 IP 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!confirm(`IP ${ip}의 차단을 해제하시겠습니까?`)) return;

    try {
      await api.post('/moderation/unblock-ip', { ip });
      alert('차단이 해제되었습니다.');
      fetchBlockedIps(); // Refresh list
    } catch (error) {
      console.error('Failed to unblock IP', error);
      alert('차단 해제에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBlockedIps();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-red-600">
            <FiShieldOff />
            차단된 IP 관리 (Blocked IPs)
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium sticky top-0">
              <tr>
                <th className="px-6 py-3">IP Address</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Blocked Date</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <FiRefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    목록을 불러오는 중...
                  </td>
                </tr>
              ) : ips.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    현재 차단된 IP가 없습니다.
                  </td>
                </tr>
              ) : (
                ips.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-red-600 dark:text-red-400">
                      {item.originalIp}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {item.reason}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleUnblock(item.originalIp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                        해제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end">
          <button
            onClick={fetchBlockedIps}
            className="mr-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 dark:bg-zinc-800 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
