'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS, AIClientType } from '@/types/mcp';

interface McpActivityChartProps {
  data: Array<{
    time: string;
    claude: number;
    chatgpt: number;
    gemini: number;
    qwen: number;
    unknown: number;
    total: number;
  }>;
  height?: number;
}

export default function McpActivityChart({ data, height = 300 }: McpActivityChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload
            .filter((entry: any) => entry.dataKey !== 'total')
            .map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-gray-600">
                    {AI_CLIENT_LABELS[entry.dataKey as AIClientType] || entry.dataKey}:
                  </span>
                </span>
                <span className="font-medium">{entry.value}</span>
              </div>
            ))}
          <div className="flex items-center justify-between gap-4 text-sm mt-2 pt-2 border-t">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold">{payload[0]?.payload?.total || 0}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">시간대별 AI 활동</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
            formatter={(value) => AI_CLIENT_LABELS[value as AIClientType] || value}
          />
          <Line
            type="monotone"
            dataKey="claude"
            stroke={AI_CLIENT_COLORS.claude}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="chatgpt"
            stroke={AI_CLIENT_COLORS.chatgpt}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="gemini"
            stroke={AI_CLIENT_COLORS.gemini}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="qwen"
            stroke={AI_CLIENT_COLORS.qwen}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="unknown"
            stroke={AI_CLIENT_COLORS.unknown}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}