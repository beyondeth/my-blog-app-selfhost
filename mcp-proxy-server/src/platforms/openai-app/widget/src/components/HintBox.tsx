interface HintBoxProps {
  text: string;
  isWarning?: boolean;
}

export default function HintBox({ text, isWarning }: HintBoxProps) {
  if (!text) return null;

  return (
    <div className={`hint${isWarning ? ' is-warning' : ''}`}>
      {text}
    </div>
  );
}
