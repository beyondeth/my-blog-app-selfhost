import GuideScreenshot from '@/components/public-site/GuideScreenshot';

type AppGuideStepProps = {
  step: number;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  caption: string;
  note?: string;
};

export default function AppGuideStep({
  step,
  title,
  description,
  imageSrc,
  imageAlt,
  caption,
  note,
}: AppGuideStepProps) {
  return (
    <div className="not-prose rounded-[28px] border border-[#E6ECF3] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#223244] dark:bg-[#0F1720] dark:shadow-none">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-sm font-semibold text-[#1A73E8] dark:bg-[#1A2B45] dark:text-[#8AB4F8]">
          {step}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[#101828] dark:text-white">{title}</h3>
          <p className="text-sm leading-7 text-[#475467] dark:text-[#9FB0C2]">{description}</p>
          {note ? (
            <p className="rounded-2xl border border-[#F5D08A] bg-[#FFF8E8] px-4 py-3 text-sm leading-6 text-[#8A5B00] dark:border-[#5E4720] dark:bg-[#261D0C] dark:text-[#F6D58A]">
              {note}
            </p>
          ) : null}
        </div>
      </div>
      <GuideScreenshot src={imageSrc} alt={imageAlt} caption={caption} />
    </div>
  );
}
