import fs from 'node:fs';
import path from 'node:path';
import Image from 'next/image';

type GuideScreenshotProps = {
  src: string;
  alt: string;
  caption: string;
};

function normalizePublicSrc(src: string) {
  return src.startsWith('/') ? src : `/${src}`;
}

export default function GuideScreenshot({
  src,
  alt,
  caption,
}: GuideScreenshotProps) {
  const normalizedSrc = normalizePublicSrc(src);
  const relativePath = normalizedSrc.replace(/^\//, '');
  const filePath = path.join(process.cwd(), 'public', relativePath);
  const hasImage = fs.existsSync(filePath);

  return (
    <figure className="not-prose overflow-hidden rounded-[24px] border border-[#E6ECF3] bg-[#FBFCFF] dark:border-[#223244] dark:bg-[#111D29]">
      {hasImage ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#F3F6FB] dark:bg-[#0F1720]">
          <Image
            src={normalizedSrc}
            alt={alt}
            fill
            className="object-contain object-top"
            sizes="(max-width: 1024px) 100vw, 900px"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full flex-col justify-center gap-3 bg-[linear-gradient(135deg,#F7FAFF_0%,#EEF4FF_100%)] px-6 py-8 dark:bg-[linear-gradient(135deg,#101826_0%,#152234_100%)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B74A8] dark:text-[#8FA5BA]">
            Screenshot Slot
          </span>
          <h4 className="text-lg font-semibold text-[#101828] dark:text-white">
            Replace this file with your screenshot
          </h4>
          <p className="max-w-2xl text-sm leading-6 text-[#475467] dark:text-[#9FB0C2]">
            Put the final screenshot in the exact path below. The docs page will start rendering
            it automatically without any code changes.
          </p>
          <code className="inline-flex w-fit rounded-xl border border-[#D7E3F5] bg-white px-3 py-2 text-xs text-[#1D2939] dark:border-[#2C425A] dark:bg-[#0D1623] dark:text-[#DCE7F5]">
            frontend/public/{relativePath}
          </code>
        </div>
      )}
      <figcaption className="border-t border-[#E6ECF3] px-5 py-4 text-sm leading-6 text-[#475467] dark:border-[#223244] dark:text-[#9FB0C2]">
        {caption}
      </figcaption>
    </figure>
  );
}
