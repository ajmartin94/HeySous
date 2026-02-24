import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { RefreshCw } from 'lucide-react';
import { useAdminData } from '../hooks/useAdminData';
import { BarChart } from '../components/admin/BarChart';
import { SkeletonCard } from '../components/SkeletonCard';
import type { TimeRange, ActivityEvent } from '../hooks/useAdminData';

// -- Utility: format relative time --

function formatRelativeTime(epochSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - epochSeconds;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

// -- Utility: format day label for chart --

function formatDayLabel(dayStr: string): string {
  // dayStr is "YYYY-MM-DD"
  const parts = dayStr.split('-');
  if (parts.length < 3) return dayStr;
  return `${parts[1]}/${parts[2]}`;
}

// -- Style constants --

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 'var(--hs-font-size-small)',
  fontWeight: 600,
  color: 'var(--tg-theme-hint-color, #999)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '10px',
  marginTop: '24px',
};

const cardContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
};

const statCardStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 'var(--hs-border-radius)',
  background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
  border: '1px solid var(--tgui--divider, rgba(0,0,0,0.08))',
};

const statNumberStyle: React.CSSProperties = {
  fontSize: 'calc(var(--hs-font-size-heading) + 4px)',
  fontWeight: 700,
  color: 'var(--tg-theme-text-color, #000)',
  lineHeight: 1.2,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 'var(--hs-font-size-small)',
  color: 'var(--tg-theme-hint-color, #999)',
  marginTop: '2px',
};

const pillRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '12px',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '10px',
    border: 'none',
    fontSize: 'var(--hs-font-size-small)',
    fontWeight: 500,
    cursor: 'pointer',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? 'var(--hs-accent)' : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    color: active ? '#ffffff' : 'var(--tg-theme-text-color, #000)',
    transition: 'background 0.15s, color 0.15s',
    WebkitTapHighlightColor: 'transparent',
  };
}

function smallPillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: '8px',
    border: 'none',
    fontSize: 'var(--hs-font-size-small)',
    fontWeight: 500,
    cursor: 'pointer',
    background: active ? 'var(--hs-accent)' : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
    color: active ? '#ffffff' : 'var(--tg-theme-text-color, #000)',
    transition: 'background 0.15s, color 0.15s',
    WebkitTapHighlightColor: 'transparent',
    whiteSpace: 'nowrap',
  };
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 'var(--hs-font-size-small)',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontWeight: 600,
  color: 'var(--tg-theme-hint-color, #999)',
  borderBottom: '1px solid var(--tgui--divider, rgba(0,0,0,0.08))',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--tg-theme-text-color, #000)',
  borderBottom: '1px solid var(--tgui--divider, rgba(0,0,0,0.06))',
};

const loadMoreBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid var(--tgui--divider, rgba(0,0,0,0.12))',
  background: 'transparent',
  color: 'var(--hs-accent)',
  fontSize: 'var(--hs-font-size-small)',
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: '8px',
  WebkitTapHighlightColor: 'transparent',
};

const eventDotColors: Record<string, string> = {
  message: '#4caf50',
  tool_call: '#2196f3',
  feedback: '#ff9800',
};

// -- Event type filter options --

const eventTypeFilters = [
  { value: 'all', label: 'All' },
  { value: 'message', label: 'Messages' },
  { value: 'tool_call', label: 'Tool Calls' },
  { value: 'feedback', label: 'Feedback' },
];

// -- Source badge styles --

const sourceBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: '6px',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
};

function getSourceBadgeColor(source: string): React.CSSProperties {
  switch (source) {
    case 'command':
      return { background: 'rgba(33,150,243,0.15)', color: '#2196f3' };
    case 'implicit':
      return { background: 'rgba(156,39,176,0.15)', color: '#9c27b0' };
    case 'mini-app':
      return { background: 'rgba(76,175,80,0.15)', color: '#4caf50' };
    case 'proactive':
      return { background: 'rgba(255,152,0,0.15)', color: '#ff9800' };
    default:
      return { background: 'rgba(158,158,158,0.15)', color: '#9e9e9e' };
  }
}

// -- Helper: describe activity event --

function describeEvent(event: ActivityEvent): string {
  switch (event.eventType) {
    case 'message': {
      const dir = event.details.direction === 'in' ? 'sent' : 'received';
      const text = event.details.text as string;
      return `${dir}: ${text}`;
    }
    case 'tool_call': {
      const model = event.details.model as string;
      const cost = event.details.cost as number;
      return `${model} - $${cost.toFixed(4)}`;
    }
    case 'feedback': {
      const text = event.details.text as string;
      return text;
    }
    default:
      return JSON.stringify(event.details);
  }
}

// -- Main component --

export function Admin() {
  const navigate = useNavigate();
  const {
    activity,
    stats,
    costs,
    feedback,
    range,
    setRange,
    activityFilter,
    setActivityFilter,
    loadMoreActivity,
    loadMoreFeedback,
    refresh,
  } = useAdminData();

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => {
      off();
    };
  }, [navigate]);

  const isLoading = stats.loading || costs.loading || activity.loading || feedback.loading;

  // Compute unique users from activity events for filter dropdown
  const uniqueUsers = Array.from(
    new Map(
      activity.events.map((e) => [e.userId, e.userName]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  // Compute budget line for cost chart
  let budgetDollars: number | undefined;
  if (costs.data) {
    const totalTokens = costs.data.byModel.reduce((sum, m) => sum + m.tokens, 0);
    if (totalTokens > 0 && costs.data.dailyBudgetTokens > 0) {
      budgetDollars = (costs.data.dailyBudgetTokens / totalTokens) * costs.data.totalCost;
    }
  }

  // Error state
  if (stats.error && costs.error && activity.error && feedback.error) {
    return (
      <div style={{ padding: 'var(--hs-spacing-section)' }}>
        <div
          style={{
            fontSize: 'var(--hs-font-size-heading)',
            fontWeight: 600,
            color: 'var(--hs-accent)',
            paddingBottom: '8px',
          }}
        >
          Admin Dashboard
        </div>
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--tg-theme-hint-color, #999)',
          }}
        >
          <div style={{ fontSize: 'var(--hs-font-size-body)', marginBottom: '12px' }}>
            Failed to load dashboard data
          </div>
          <button
            onClick={refresh}
            style={{
              background: 'var(--hs-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: 'var(--hs-font-size-body)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      {/* Header */}
      <div
        style={{
          fontSize: 'var(--hs-font-size-heading)',
          fontWeight: 600,
          color: 'var(--hs-accent)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: '8px',
        }}
      >
        <span style={{ flex: 1 }}>Admin Dashboard</span>
        <button
          onClick={refresh}
          disabled={isLoading}
          style={{
            background: 'none',
            border: 'none',
            padding: 8,
            cursor: isLoading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--tg-theme-hint-color, #999)',
            opacity: isLoading ? 0.5 : 1,
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Refresh"
        >
          <RefreshCw
            size={20}
            style={isLoading ? { animation: 'spin 1s linear infinite' } : undefined}
          />
        </button>
      </div>

      {/* Inline keyframes for spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ---- SUMMARY CARDS ---- */}
      <div style={sectionLabelStyle}>Overview</div>

      {/* Time range pills */}
      <div style={pillRowStyle}>
        {([['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days']] as const).map(([val, label]) => (
          <button key={val} style={pillStyle(range === val)} onClick={() => setRange(val)}>
            {label}
          </button>
        ))}
      </div>

      {stats.loading ? (
        <SkeletonCard lines={3} />
      ) : stats.data ? (
        <div style={cardContainerStyle}>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.data.summary.messagesCount}</div>
            <div style={statLabelStyle}>Messages</div>
          </div>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.data.summary.activeUsers}</div>
            <div style={statLabelStyle}>Active Users</div>
          </div>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{stats.data.summary.apiCalls}</div>
            <div style={statLabelStyle}>API Calls</div>
          </div>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>
              ${costs.data ? costs.data.totalCost.toFixed(2) : '--'}
            </div>
            <div style={statLabelStyle}>Total Cost</div>
          </div>
        </div>
      ) : null}

      {/* ---- COST BREAKDOWN ---- */}
      <div style={sectionLabelStyle}>Cost Breakdown</div>

      {costs.loading ? (
        <SkeletonCard lines={4} />
      ) : costs.data ? (
        <div>
          {/* Per-model table */}
          {costs.data.byModel.length > 0 && (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Model</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {costs.data.byModel.map((m) => (
                  <tr key={m.model}>
                    <td style={tdStyle}>{m.model}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>${m.cost.toFixed(4)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {m.tokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Per-user table */}
          {costs.data.byUser.length > 0 && (
            <table style={{ ...tableStyle, marginTop: '12px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {costs.data.byUser.map((u) => (
                  <tr key={u.userId}>
                    <td style={tdStyle}>{u.userName}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>${u.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Daily cost chart */}
          <div style={{ marginTop: '12px' }}>
            <BarChart
              data={costs.data.daily.map((d) => ({
                label: formatDayLabel(d.day),
                value: d.cost,
              }))}
              color="var(--hs-accent)"
              budgetLine={budgetDollars}
              formatValue={(v) => `$${v.toFixed(2)}`}
            />
          </div>
        </div>
      ) : null}

      {/* ---- ACTIVITY FEED ---- */}
      <div style={sectionLabelStyle}>Activity Feed</div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {eventTypeFilters.map((f) => (
            <button
              key={f.value}
              style={smallPillStyle(activityFilter.type === f.value)}
              onClick={() => setActivityFilter({ ...activityFilter, type: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={activityFilter.userId}
          onChange={(e) => setActivityFilter({ ...activityFilter, userId: e.target.value })}
          style={{
            padding: '4px 8px',
            borderRadius: '8px',
            border: '1px solid var(--tgui--divider, rgba(0,0,0,0.12))',
            background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
            color: 'var(--tg-theme-text-color, #000)',
            fontSize: 'var(--hs-font-size-small)',
            cursor: 'pointer',
          }}
        >
          <option value="all">All Users</option>
          {uniqueUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event list */}
      {activity.loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : activity.events.length === 0 ? (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--tg-theme-hint-color, #999)',
            fontSize: 'var(--hs-font-size-body)',
          }}
        >
          No activity found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {activity.events.map((event) => (
            <div
              key={`${event.eventType}-${event.id}`}
              style={{
                padding: '8px 10px',
                borderRadius: 'var(--hs-border-radius)',
                background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}
            >
              {/* Type dot */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: eventDotColors[event.eventType] ?? '#9e9e9e',
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 'var(--hs-font-size-small)',
                      color: 'var(--tg-theme-text-color, #000)',
                    }}
                  >
                    {event.userName}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--tg-theme-hint-color, #999)',
                    }}
                  >
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--hs-font-size-small)',
                    color: 'var(--tg-theme-hint-color, #999)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {describeEvent(event)}
                </div>
              </div>
            </div>
          ))}

          {activity.hasMore && (
            <button style={loadMoreBtnStyle} onClick={loadMoreActivity}>
              Load more
            </button>
          )}
        </div>
      )}

      {/* ---- FEEDBACK OVERVIEW ---- */}
      <div style={sectionLabelStyle}>Feedback Overview</div>

      {feedback.loading ? (
        <SkeletonCard lines={3} />
      ) : (
        <div>
          {/* Summary line */}
          <div
            style={{
              fontSize: 'var(--hs-font-size-small)',
              color: 'var(--tg-theme-hint-color, #999)',
              marginBottom: '10px',
            }}
          >
            {feedback.total} total entries, {feedback.recentCount} in last 7 days
          </div>

          {feedback.entries.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--tg-theme-hint-color, #999)',
                fontSize: 'var(--hs-font-size-body)',
              }}
            >
              No feedback yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {feedback.entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--hs-border-radius)',
                    background: 'var(--tg-theme-secondary-bg-color, #f5f5f5)',
                    border: '1px solid var(--tgui--divider, rgba(0,0,0,0.06))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: 'var(--hs-font-size-small)',
                        color: 'var(--tg-theme-text-color, #000)',
                      }}
                    >
                      {entry.userName}
                    </span>
                    <span
                      style={{
                        ...sourceBadgeStyle,
                        ...getSourceBadgeColor(entry.source),
                      }}
                    >
                      {entry.source}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--tg-theme-hint-color, #999)',
                        marginLeft: 'auto',
                      }}
                    >
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--hs-font-size-body)',
                      color: 'var(--tg-theme-text-color, #000)',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}

              {feedback.hasMore && (
                <button style={loadMoreBtnStyle} onClick={loadMoreFeedback}>
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom spacing */}
      <div style={{ height: '32px' }} />
    </div>
  );
}
