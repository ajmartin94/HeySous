import { X } from 'lucide-react';

interface TagChipBarProps {
  activeTag: string | null;
  onRemove: () => void;
}

export function TagChipBar({ activeTag, onRemove }: TagChipBarProps) {
  if (activeTag === null) return null;

  return (
    <div className="tag-chip-bar">
      <button className="tag-chip-bar__chip" onClick={onRemove}>
        {activeTag}
        <X size={12} />
      </button>
    </div>
  );
}
