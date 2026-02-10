interface WeekHeaderProps {
  activeWeekIndex: number;
}

export function WeekHeader({ activeWeekIndex }: WeekHeaderProps) {
  const label = activeWeekIndex === 0 ? 'This Week' : 'Next Week';

  return (
    <div className="week-header">
      <div className="week-header__label">{label}</div>
      <div className="week-header__dots">
        <span
          className={`week-header__dot${activeWeekIndex === 0 ? ' week-header__dot--active' : ''}`}
        />
        <span
          className={`week-header__dot${activeWeekIndex === 1 ? ' week-header__dot--active' : ''}`}
        />
      </div>
    </div>
  );
}
