import React from 'react';

interface KakaoTalkBubbleProps {
  message: string;
  isSender?: boolean;
  className?: string;
}

export const KakaoTalkBubble: React.FC<KakaoTalkBubbleProps> = ({
  message,
  isSender = true,
  className = "",
}) => {
  return (
    <div
      className={`
        relative max-w-xs px-4 py-3 text-sm leading-relaxed
        ${isSender
          ? 'ml-auto bg-yellow-400 text-black kakao-bubble-sender'
          : 'mr-auto bg-gray-700 text-white kakao-bubble-receiver'
        }
        ${className}
      `}
      style={{
        borderRadius: '18px',
        backgroundColor: isSender ? '#FAE100' : '#3d3d3d',
      }}
    >
      {message}

      {/* Tail using pseudo-element */}
      <style jsx>{`
        .kakao-bubble-sender::after {
          content: '';
          position: absolute;
          top: -2px;
          right: -8px;
          width: 20px;
          height: 20px;
          background-color: #FAE100;
          border-radius: 0 0 18px 18px;
          transform: rotate(45deg);
          z-index: -1;
        }

        .kakao-bubble-receiver::after {
          content: '';
          position: absolute;
          top: -2px;
          left: -8px;
          width: 20px;
          height: 20px;
          background-color: #3d3d3d;
          border-radius: 0 0 18px 18px;
          transform: rotate(-45deg);
          z-index: -1;
        }
      `}</style>
    </div>
  );
};

export default KakaoTalkBubble;