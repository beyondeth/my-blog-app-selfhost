import { memo } from "react"

export const YoutubeIcon = memo(
  ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    return (
      <svg
        width="24"
        height="24"
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21.582 7.186a2.52 2.52 0 0 0-1.768-1.786C18.254 5 12 5 12 5s-6.254 0-7.814.4A2.52 2.52 0 0 0 2.418 7.186C2 8.758 2 12 2 12s0 3.242.418 4.814a2.52 2.52 0 0 0 1.768 1.786c1.56.4 7.814.4 7.814.4s6.254 0 7.814-.4a2.52 2.52 0 0 0 1.768-1.786C22 15.242 22 12 22 12s0-3.242-.418-4.814zM10 15V9l5.196 3L10 15z"
          fill="currentColor"
        />
      </svg>
    )
  }
)

YoutubeIcon.displayName = "YoutubeIcon"
