interface ProgressBarProps {
  checked: number;
  total: number;
}

export function ProgressBar({ checked, total }: ProgressBarProps) {
  return (
    <div className="progress-bar">
      {checked}/{total} items
    </div>
  );
}
