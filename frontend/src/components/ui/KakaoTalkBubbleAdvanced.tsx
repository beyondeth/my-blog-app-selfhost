import React from 'react';

interface KakaoTalkBubbleAdvancedProps {
  message: string;
  isSender?: boolean;
  timestamp?: string;
  className?: string;
}

/**
 * Advanced KakaoTalk-style message bubble with SVG tail for perfect curves
 */
export const KakaoTalkBubbleAdvanced: React.FC<KakaoTalkBubbleAdvancedProps> = ({
  message,
  isSender = true,
  timestamp,
  className = "",
}) => {
  const bubbleColor = isSender ? '#FAE100' : '#3d3d3d';
  const textColor = isSender ? '#000' : '#fff';

  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2 ${className}`}>
      <div className={`flex items-end gap-2 ${isSender ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Message bubble with SVG tail */}
        <div className="relative">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            className={`absolute ${isSender ? 'right-0 top-0 translate-x-[10px]' : 'left-0 top-0 -translate-x-[10px]'}`}
            style={{ zIndex: -1 }}
          >
            <path
              d={isSender
                ? "M0,20 Q0,0 20,0 L20,20 Z"
                : "M20,20 Q20,0 0,0 L0,20 Z"
              }
              fill={bubbleColor}
              transform={isSender ? "rotate(0)" : "rotate(0)"}
            />
          </svg>

          <div
            className="relative px-4 py-3 text-sm leading-relaxed max-w-xs"
            style={{
              backgroundColor: bubbleColor,
              color: textColor,
              borderRadius: '18px',
              wordWrap: 'break-word',
              marginRight: isSender ? '10px' : '0',
              marginLeft: isSender ? '0' : '10px',
            }}
          >
            {message}
          </div>
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">
            {timestamp}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Pure CSS version with clip-path for exact KakaoTalk shape
 */
export const KakaoTalkBubbleCSS: React.FC<KakaoTalkBubbleAdvancedProps> = ({
  message,
  isSender = true,
  timestamp,
  className = "",
}) => {
  return (
    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2 ${className}`}>
      <div className={`flex items-end gap-2 ${isSender ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Message bubble */}
        <div
          className={`
            relative px-4 py-3 text-sm leading-relaxed max-w-xs
            ${isSender ? 'kakao-bubble-sender-advanced' : 'kakao-bubble-receiver-advanced'}
          `}
          style={{
            backgroundColor: isSender ? '#FAE100' : '#3d3d3d',
            color: isSender ? '#000' : '#fff',
            borderRadius: '18px',
            wordWrap: 'break-word',
          }}
        >
          {message}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">
            {timestamp}
          </div>
        )}
      </div>

      <style jsx>{`
        .kakao-bubble-sender-advanced {
          margin-right: 12px;
          position: relative;
        }

        .kakao-bubble-sender-advanced::before {
          content: '';
          position: absolute;
          top: 2px;
          right: -10px;
          width: 0;
          height: 0;
          border-left: 12px solid #FAE100;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-radius: 0 0 0 8px;
          transform: rotate(15deg);
        }

        .kakao-bubble-receiver-advanced {
          margin-left: 12px;
          position: relative;
        }

        .kakao-bubble-receiver-advanced::before {
          content: '';
          position: absolute;
          top: 2px;
          left: -10px;
          width: 0;
          height: 0;
          border-right: 12px solid #3d3d3d;
          border-top: 8px solid transparent;
          border-bottom: 8px solid transparent;
          border-radius: 0 0 8px 0;
          transform: rotate(-15deg);
        }
      `}</style>
    </div>
  );
};

/**
 * Chat container component for demo
 */
export const KakaoTalkChat: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      className="p-4 max-w-md mx-auto min-h-96 flex flex-col gap-1"
      style={{ backgroundColor: '#f5f5f5' }}
    >
      {children}
    </div>
  );
};

export default KakaoTalkBubbleAdvanced;