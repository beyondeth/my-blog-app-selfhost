'use client';

import dynamic from 'next/dynamic';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS, AIClientType } from '@/types/mcp';
import { Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic import for ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface McpClientDistributionProps {
  data: Array<{
    name: string;
    value: number;
    clientType: AIClientType;
  }>;
  height?: number;
}

export default function McpClientDistribution({ data, height = 300 }: McpClientDistributionProps) {
  // Calculate total for percentage display
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Prepare series data for ApexCharts
  const series = data.map(item => item.value);
  const labels = data.map(item => AI_CLIENT_LABELS[item.clientType as AIClientType] || item.name);
  const colors = data.map(item => AI_CLIENT_COLORS[item.clientType] || AI_CLIENT_COLORS.unknown);

  // Create gradient colors for 3D effect
  const gradientColors = colors.map(color => {
    // Darken color for gradient effect
    const darkenColor = (color: string, amount: number) => {
      const num = parseInt(color.replace('#', ''), 16);
      const r = Math.max(0, (num >> 16) - amount);
      const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
      const b = Math.max(0, (num & 0x0000ff) - amount);
      return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    };
    return darkenColor(color, 30);
  });

  // ApexCharts options with 3D effect and gradient
  const donutChartOptions: any = {
    chart: {
      type: 'donut',
      animations: {
        enabled: true,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      },
      dropShadow: {
        enabled: true,
        color: '#000',
        top: 3,
        left: 0,
        blur: 10,
        opacity: 0.15
      }
    },
    labels: labels,
    colors: colors,
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.4,
        gradientToColors: gradientColors,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 0.8,
        stops: [0, 100]
      }
    },
    stroke: {
      width: 2,
      colors: ['#ffffff']
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontWeight: 600,
              color: '#4B5563',
              offsetY: -10
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1F2937',
              offsetY: 5,
              formatter: function(val: string) {
                return val;
              }
            },
            total: {
              show: true,
              showAlways: true,
              label: '전체 활동',
              fontSize: '12px',
              fontWeight: 600,
              color: '#6B7280',
              formatter: function(w: any) {
                return total.toLocaleString() + '회';
              }
            }
          }
        },
        expandOnClick: true,
        offsetX: 0,
        offsetY: 0,
        customScale: 1,
        dataLabels: {
          offset: 0,
          minAngleToShowLabel: 10
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return Math.round(val) + '%';
      },
      style: {
        fontSize: '12px',
        fontWeight: 'bold',
        colors: ['#ffffff']
      },
      dropShadow: {
        enabled: true,
        color: '#000',
        top: 1,
        left: 1,
        blur: 1,
        opacity: 0.45
      }
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '13px',
      fontFamily: undefined,
      fontWeight: 400,
      labels: {
        colors: '#4B5563'
      },
      markers: {
        width: 12,
        height: 12,
        strokeWidth: 0,
        strokeColor: '#fff',
        radius: 12,
        offsetX: 0,
        offsetY: 0
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      },
      formatter: function(seriesName: string, opts: any) {
        const value = opts.w.globals.series[opts.seriesIndex];
        const percentage = ((value / total) * 100).toFixed(1);
        return `${seriesName}: ${value.toLocaleString()} (${percentage}%)`;
      }
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: function(val: number) {
          return val.toLocaleString() + ' 회';
        }
      },
      style: {
        fontSize: '12px'
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 클라이언트 분포</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <Chart
            options={donutChartOptions}
            series={series}
            type="donut"
            height={height}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>AI 활동 데이터를 수집 중입니다</p>
              <p className="text-sm mt-1">잠시 후 다시 확인해주세요</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}