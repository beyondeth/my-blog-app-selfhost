import { t } from '../i18n';

interface ProgressStepperProps {
  stage: string;
}

const STEP_ORDER = ['awaiting_style_selection', 'drafting', 'published'] as const;

function getActiveIndex(stage: string): number {
  if (stage === 'published') return 2;
  if (stage === 'drafting' || stage === 'guide_ready' || stage === 'style_confirmed') return 1;
  return 0;
}

export default function ProgressStepper({ stage }: ProgressStepperProps) {
  const activeIndex = getActiveIndex(stage);
  const isPublished = stage === 'published';
  const steps = [
    {
      key: STEP_ORDER[0],
      title: t('progress_select_title'),
      description: t('progress_select_desc'),
    },
    {
      key: STEP_ORDER[1],
      title: t('progress_draft_title'),
      description: t('progress_draft_desc'),
    },
    {
      key: STEP_ORDER[2],
      title: t('progress_publish_title'),
      description: isPublished ? t('progress_publish_done_desc') : t('progress_publish_desc'),
    },
  ];

  return (
    <section className="progress-card" aria-label={t('progress_label')}>
      {steps.map((step, index) => {
        const state =
          isPublished || index < activeIndex
            ? 'done'
            : index === activeIndex
              ? 'active'
              : 'pending';

        return (
          <div key={step.key} className={`progress-item progress-item-${state}`}>
            <div className="progress-marker" aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </div>
            <div className="progress-copy">
              <p className="progress-title">{step.title}</p>
              <p className="progress-desc">{step.description}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
