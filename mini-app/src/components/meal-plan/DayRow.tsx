import type { Ref } from 'react';
import type { MealPlanEntry } from '../../hooks/useMealPlan.js';
import { formatDayHeader } from '../../utils/dateUtils.js';
import { MealEntry, MEAL_ICONS, MEAL_LABELS } from './MealEntry.js';

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'snack', 'dinner', 'dessert', 'other'] as const;

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
        MEAL_TYPE_ORDER.map((mealType) => {
          const typeEntries = entries.filter((e) => e.mealType === mealType);
          if (typeEntries.length === 0) return null;

          const Icon = MEAL_ICONS[mealType];
          const label = MEAL_LABELS[mealType] || mealType;

          return (
            <div key={mealType} className="meal-type-section">
              <div className="meal-type-section__header">
                <span className={`meal-entry__icon meal-entry__icon--${mealType}`}>
                  <Icon size={14} />
                </span>
                <span>{label}</span>
              </div>
              {typeEntries.map((entry) => (
                <MealEntry key={entry.id} entry={entry} onTap={onMealTap} />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
