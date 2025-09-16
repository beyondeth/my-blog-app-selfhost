import React from 'react';

interface QualityScoreBadgeProps {
  score: number;
  aiType?: string;
  className?: string;
}

const QualityScoreBadge: React.FC<QualityScoreBadgeProps> = ({ score, aiType = 'UNKNOWN', className = '' }) => {
  // AI 타입별 색상 매핑 (Admin AI Tracking과 일치)
  const getAIColor = (type: string): string => {
    const colorMap: { [key: string]: string } = {
      'claude': '#D97757',    // Claude 주황색
      'chatgpt': '#000000',   // 검정색
      'gemini': '#3B82F6',    // 파란색
      'qwen': '#8B5CF6',      // 보라색
      'unknown': '#6B7280',   // 회색
    };
    return colorMap[type.toLowerCase()] || colorMap['unknown'];
  };

  // 점수에 따른 게이지 색상
  const getGaugeColor = () => {
    if (score >= 80) return '#10b981'; // 녹색
    if (score >= 60) return '#06b6d4'; // 파란색 (cyan)
    return '#ef4444'; // 빨간색
  };

  // 원형 게이지 계산 (크기 2/3로 축소)
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);

  const aiColor = getAIColor(aiType);
  const gaugeColor = getGaugeColor();
  const displayAIType = aiType.toUpperCase();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      role="img"
      aria-labelledby={`quality-score-${score}`}
      className={className}
    >
      <title id={`quality-score-${score}`}>AI 작성 품질 점수 - {score}점 ({displayAIType})</title>

      {/* 상단 원형 게이지 */}
      {/* 배경 원 */}
      <circle cx="20" cy="14" r="11" fill="#071028"/>

      {/* 트랙 */}
      <circle cx="20" cy="14" r="11" fill="none" stroke="#1e293b" strokeWidth="2.5"/>

      {/* 진행 게이지 */}
      <circle
        cx="20"
        cy="14"
        r="11"
        fill="none"
        stroke={gaugeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 20 14)"
      />

      {/* 중앙 텍스트 (점수) */}
      <text
        x="20"
        y="14"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="9"
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {score}
      </text>

      {/* 하단 AI 라벨 */}
      <rect x="4" y="28" width="32" height="10" rx="2" fill={aiColor}/>
      <text
        x="20"
        y="33"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="600"
        fontSize="7"
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {displayAIType}
      </text>
    </svg>
  );
};

export default QualityScoreBadge;