"use client";

import * as React from "react";
import { useTheme } from "next-themes";

/**
 * 모던한 테마 스위치 컴포넌트
 * 스크린샷과 같은 pill 형태의 토글 스위치
 */
export function ThemeSwitch() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="theme-switch-container">
        <div className="theme-switch theme-switch-placeholder" />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className="theme-switch-container">
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={`theme-switch ${isDark ? "dark" : "light"}`}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <span className="switch-track">
          <span className="switch-thumb">
            {isDark ? (
              // Moon icon with stars
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="icon-moon"
              >
                <path d="M21.7 13.3L20.3 12l1.4-1.3c.4-.4.4-1 0-1.4s-1-.4-1.4 0L19 10.7 17.7 9.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4L17.6 12l-1.3 1.3c-.4.4-.4 1 0 1.4.2.2.5.3.7.3s.5-.1.7-.3l1.3-1.3 1.3 1.3c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4zM21.7 3.3c-.4-.4-1-.4-1.4 0l-1.3 1.3-1.3-1.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4L17.6 6l-1.3 1.3c-.4.4-.4 1 0 1.4.2.2.5.3.7.3s.5-.1.7-.3L19 7.4l1.3 1.3c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4L20.3 6l1.4-1.3c.4-.4.4-1 0-1.4zM12 22c-1.1 0-2.1-.2-3.1-.5.4-.6.7-1.3.9-2 .5-1.5.3-3.1-.6-4.4-.9-1.4-2.4-2.2-4.1-2.2h-.4c-.1-.7-.2-1.3-.2-2C4.5 5.7 8.7 1.5 14 1.5c.9 0 1.8.1 2.7.4-.7.6-1.2 1.5-1.2 2.6 0 1.9 1.5 3.5 3.5 3.5 1 0 2-.5 2.6-1.2.2.9.4 1.8.4 2.7 0 5.5-4.5 10-10 10z"/>
              </svg>
            ) : (
              // Sun icon
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="icon-sun"
              >
                <path d="M12 7c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zM2 13h2c.6 0 1-.4 1-1s-.4-1-1-1H2c-.6 0-1 .4-1 1s.4 1 1 1zm18 0h2c.6 0 1-.4 1-1s-.4-1-1-1h-2c-.6 0-1 .4-1 1s.4 1 1 1zM11 2v2c0 .6.4 1 1 1s1-.4 1-1V2c0-.6-.4-1-1-1s-1 .4-1 1zm0 18v2c0 .6.4 1 1 1s1-.4 1-1v-2c0-.6-.4-1-1-1s-1 .4-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
              </svg>
            )}
          </span>
        </span>
      </button>

      <style jsx>{`
        .theme-switch-container {
          display: inline-flex;
          align-items: center;
        }

        .theme-switch {
          position: relative;
          width: 60px;
          height: 30px;
          padding: 4px;
          border: none;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        /* Placeholder for loading state */
        .theme-switch-placeholder {
          background: rgb(var(--muted));
          cursor: not-allowed;
        }

        /* Light mode styles */
        .theme-switch.light {
          background: linear-gradient(135deg,
            rgb(147, 197, 253) 0%,
            rgb(99, 102, 241) 100%
          );
          box-shadow:
            0 2px 10px rgba(99, 102, 241, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .theme-switch.light:hover {
          box-shadow:
            0 4px 20px rgba(99, 102, 241, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        /* Dark mode styles - 모던 다크 디자인 */
        .theme-switch.dark {
          background: linear-gradient(135deg,
            rgb(65, 63, 76) 0%,
            rgb(85, 83, 96) 100%
          );
          box-shadow:
            0 2px 10px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(196, 239, 255, 0.1);
        }

        .theme-switch.dark:hover {
          box-shadow:
            0 4px 20px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(196, 239, 255, 0.15);
        }

        /* Track */
        .switch-track {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }

        /* Thumb */
        .switch-thumb {
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.12),
            0 1px 2px rgba(0, 0, 0, 0.24);
        }

        /* Light mode thumb position */
        .theme-switch.light .switch-thumb {
          transform: translateX(0);
        }

        /* Dark mode thumb position */
        .theme-switch.dark .switch-thumb {
          transform: translateX(30px);
        }

        /* Icons */
        .icon-sun {
          color: #f59e0b;
        }

        .icon-moon {
          color: #C4EFFF;
        }

        /* Animation for icons */
        .switch-thumb svg {
          animation: iconFadeIn 300ms ease;
        }

        @keyframes iconFadeIn {
          from {
            opacity: 0;
            transform: rotate(-90deg) scale(0.5);
          }
          to {
            opacity: 1;
            transform: rotate(0) scale(1);
          }
        }

        /* Focus styles */
        .theme-switch:focus-visible {
          outline: 2px solid rgb(var(--ring));
          outline-offset: 2px;
        }

        /* Active state */
        .theme-switch:active .switch-thumb {
          width: 24px;
        }
      `}</style>
    </div>
  );
}