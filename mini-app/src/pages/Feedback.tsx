import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { backButton } from '@tma.js/sdk-react';
import { apiFetch } from '../api';

export function Feedback() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // BackButton: navigate back to hub
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const off = backButton.onClick(() => navigate(-1));
    return () => {
      off();
    };
  }, [navigate]);

  async function handleSubmit() {
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await apiFetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (res.ok) {
        setSubmitted(true);
        setText('');
      } else {
        const data = await res.json().catch(() => ({ error: 'Something went wrong' }));
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 'var(--hs-spacing-section)' }}>
        <div
          style={{
            fontSize: 'var(--hs-font-size-heading)',
            fontWeight: 600,
            color: 'var(--hs-accent)',
            paddingBottom: 'var(--hs-spacing-section)',
          }}
        >
          Give Feedback
        </div>

        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>
            Thanks for the feedback!
          </div>
          <div
            style={{
              color: 'var(--tgui--secondary_hint_color)',
              fontSize: '14px',
              marginBottom: '24px',
            }}
          >
            Your thoughts help us make HeySous better.
          </div>
          <button
            onClick={() => setSubmitted(false)}
            style={{
              background: 'var(--hs-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Send More
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--hs-spacing-section)' }}>
      <div
        style={{
          fontSize: 'var(--hs-font-size-heading)',
          fontWeight: 600,
          color: 'var(--hs-accent)',
          paddingBottom: 'var(--hs-spacing-section)',
        }}
      >
        Give Feedback
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's on your mind? Tell us what you love, what's frustrating, or what you wish was different..."
        style={{
          width: '100%',
          minHeight: '120px',
          resize: 'vertical',
          borderRadius: '12px',
          padding: '12px',
          fontSize: '16px',
          border: '1px solid var(--tgui--secondary_hint_color)',
          background: 'var(--tgui--bg_color)',
          color: 'var(--tgui--text_color)',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />

      {error && (
        <div
          style={{
            color: '#e53e3e',
            fontSize: '14px',
            marginTop: '8px',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        style={{
          background: 'var(--hs-accent)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 24px',
          fontSize: '16px',
          width: '100%',
          cursor: !text.trim() || submitting ? 'default' : 'pointer',
          opacity: !text.trim() || submitting ? 0.5 : 1,
          marginTop: '12px',
        }}
      >
        {submitting ? 'Sending...' : 'Send Feedback'}
      </button>
    </div>
  );
}
