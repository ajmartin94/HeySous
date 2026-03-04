import type { Ref } from 'react';
import { ChevronDown } from 'lucide-react';
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
  isCollapsed: boolean;
  onToggle: (dayOfWeek: number) => void;
  todayRef?: Ref<HTMLDivElement>;
}

export function DayRow({
  dayOfWeek,
  weekStartDate,
  entries,
  isToday,
  isPast,
  onMealTap,
  isCollapsed,
  onToggle,
  todayRef,
}: DayRowProps) {
  const header = formatDayHeader(weekStartDate, dayOfWeek);
  const hasEntries = entries.length > 0;

  let className = 'day-row';
  if (isToday) className += ' day-row--today';
  if (isPast) className += ' day-row--past';

  function handleHeaderClick() {
    if (hasEntries) {
      onToggle(dayOfWeek);
    }
  }

  const mealCountText = entries.length === 1 ? '1 meal' : `${entries.length} meals`;

  return (
    <div className={className} ref={todayRef}>
      <div
        className={`day-row__header${hasEntries ? ' day-row__header--tappable' : ''}`}
        onClick={hasEntries ? handleHeaderClick : undefined}
      >
        <span>{header}</span>
        {hasEntries && (
          <ChevronDown
            size={16}
            className={`day-row__chevron${isCollapsed ? ' day-row__chevron--collapsed' : ''}`}
          />
        )}
      </div>
      {!hasEntries ? (
        <div className="day-row__empty">No meals planned</div>
      ) : (
        <>
          {isCollapsed && (
            <div className="day-row__summary">{mealCountText}</div>
          )}
          <div className={`day-row__sections${isCollapsed ? ' day-row__sections--collapsed' : ''}`}>
            {MEAL_TYPE_ORDER.map((mealType) => {
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
            })}
          </div>
        </>
      )}
    </div>
  );
}
