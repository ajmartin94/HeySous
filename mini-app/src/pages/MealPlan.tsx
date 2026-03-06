import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { useSwipeable } from 'react-swipeable';
import { useMealPlan } from '../hooks/useMealPlan.js';
import { WeekHeader } from '../components/meal-plan/WeekHeader.js';
import { DayRow } from '../components/meal-plan/DayRow.js';
import { RecipeDetail } from '../components/recipes/RecipeDetail.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import { getTodayIndex, isPastDay } from '../utils/dateUtils.js';
import '../components/meal-plan/meal-plan.css';

export function MealPlan() {
  const {
    activeWeek,
    activeWeekIndex,
    setActiveWeekIndex,
    loading,
    error,
    selectedRecipeId,
    recipeDetail,
    detailLoading,
    openDetail,
    closeDetail,
  } = useMealPlan();

  const navigate = useNavigate();
  const scrollPositionRef = useRef(0);
  const todayRef = useRef<HTMLDivElement>(null);
  const [hasAutoScrolled, setHasAutoScrolled] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());

  const toggleDay = useCallback((dayOfWeek: number) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayOfWeek)) {
        next.delete(dayOfWeek);
      } else {
        next.add(dayOfWeek);
      }
      return next;
    });
  }, []);

  // BackButton handler: close detail if open, otherwise navigate back
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;

    const off = backButton.onClick(() => {
      if (selectedRecipeId !== null) {
        handleCloseDetail();
      } else {
        navigate(-1);
      }
    });

    return () => {
      off();
    };
  }, [selectedRecipeId, navigate]);

  // Auto-scroll to today on initial load
  useEffect(() => {
    if (!loading && activeWeekIndex === 0 && todayRef.current && !hasAutoScrolled) {
      setHasAutoScrolled(true);
      requestAnimationFrame(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [loading]);

  function handleOpenDetail(knowledgeItemId: number) {
    scrollPositionRef.current = window.scrollY;
    openDetail(knowledgeItemId);
  }

  function handleCloseDetail() {
    closeDetail();
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeWeekIndex === 0) setActiveWeekIndex(1);
    },
    onSwipedRight: () => {
      if (activeWeekIndex === 1) setActiveWeekIndex(0);
    },
    delta: 50,
    trackTouch: true,
    trackMouse: false,
    swipeDuration: 500,
  });

  // Branch A: RecipeDetail view
  if (selectedRecipeId !== null) {
    if (detailLoading || !recipeDetail) {
      return (
        <div className="meal-plan-page">
          <div className="meal-plan-skeleton">
            <SkeletonCard lines={6} />
          </div>
        </div>
      );
    }
    return (
      <div className="meal-plan-page">
        <RecipeDetail recipe={recipeDetail} onBack={handleCloseDetail} />
      </div>
    );
  }

  // Branch B: Loading state
  if (loading) {
    return (
      <div className="meal-plan-page">
        <WeekHeader activeWeekIndex={activeWeekIndex} />
        <div className="meal-plan-skeleton">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="meal-plan-page">
        <WeekHeader activeWeekIndex={activeWeekIndex} />
        <div className="day-row__empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
          {error}
        </div>
      </div>
    );
  }

  // Determine week start date (use a fallback for empty weeks)
  const weekStartDate = activeWeek?.weekStartDate ?? '';

  // Branch C: Week view (default)
  return (
    <div {...swipeHandlers} className="meal-plan-page">
      <WeekHeader activeWeekIndex={activeWeekIndex} />
      <div className="week-content">
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
          const dayEntries = activeWeek?.entries.filter(
            (e) => e.dayOfWeek === dayOfWeek
          ) ?? [];
          const isToday = activeWeekIndex === 0 && dayOfWeek === getTodayIndex();
          const past = isPastDay(dayOfWeek, activeWeekIndex === 0);

          return (
            <DayRow
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              weekStartDate={weekStartDate}
              entries={dayEntries}
              isToday={isToday}
              isPast={past}
              onMealTap={handleOpenDetail}
              isCollapsed={collapsedDays.has(dayOfWeek)}
              onToggle={toggleDay}
              todayRef={isToday ? todayRef : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
