import type { Ref } from 'react';
import type { MealPlanEntry } from '../../hooks/useMealPlan.js';
import { formatDayHeader } from '../../utils/dateUtils.js';
import { MealEntry } from './MealEntry.js';

interface DayRowProps {
  dayOfWeek: number;
  weekStartDate: string;
  entries: MealPlanEntry[];
  isToday: boolean;
  isPast: boolean;
  onMealTap: (knowledgeItemId: number) => void;
  todayRef?: Ref<HTMLDivElement>;
}

export function DayRow({
  dayOfWeek,
  weekStartDate,
  entries,
  isToday,
  isPast,
  onMealTap,
  todayRef,
}: DayRowProps) {
  const header = formatDayHeader(weekStartDate, dayOfWeek);

  let className = 'day-row';
  if (isToday) className += ' day-row--today';
  if (isPast) className += ' day-row--past';

  return (
    <div className={className} ref={todayRef}>
      <div className="day-row__header">{header}</div>
      {entries.length === 0 ? (
        <div className="day-row__empty">No meals planned</div>
      ) : (
        entries.map((entry) => (
          <MealEntry key={entry.id} entry={entry} onTap={onMealTap} />
        ))
      )}
    </div>
  );
}
