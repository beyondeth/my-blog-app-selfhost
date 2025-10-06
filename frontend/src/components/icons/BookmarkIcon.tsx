/**
 * 북마크 아이콘 컴포넌트
 * currentColor를 사용하여 다크모드/라이트모드 자동 대응
 */
interface BookmarkIconProps {
  className?: string;
  size?: number;
}

export const BookmarkIcon = ({ className = '', size = 24 }: BookmarkIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
};
