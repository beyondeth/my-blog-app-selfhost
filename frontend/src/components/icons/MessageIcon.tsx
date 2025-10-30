/**
 * 채팅(DM) 아이콘 컴포넌트
 * 말풍선 모양의 채팅 아이콘
 * currentColor를 사용하여 테마에 맞게 자동 대응
 */
interface MessageIconProps {
  className?: string;
  size?: number;
}

export const MessageIcon = ({ className = '', size = 24 }: MessageIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      viewBox="0 -960 960 960"
      width={size}
      fill="currentColor"
      className={className}
    >
      <path d="M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM880-80 720-240H160q-33 0-56.5-23.5T80-320v-480q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v720ZM160-320h594l46 45v-525H160v480Zm0 0v-480 480Z" />
    </svg>
  );
};
