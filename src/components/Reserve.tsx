import {useState, useRef, useEffect, type FormEvent} from 'react';
import {feedback as feedbackContent} from '../content';
import {useReveals} from '../hooks/useReveals';

export type FeedbackType = 'Bug Report' | 'Feature Request' | 'General Feedback';

export interface Web3FormsPayload {
  access_key: string;
  subject: string;
  feedback_type: FeedbackType;
  message: string;
  email?: string;
  from_name?: string;
}

export interface ToastNotification {
  type: 'success' | 'error' | 'unconfigured';
  message: string;
  detail?: string;
}

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

interface FeedbackProps {
  onEnter?: () => void;
  initialToast?: ToastNotification;
}

/**
 * Reality.exe Feedback Section
 * Integrated with Web3Forms (https://api.web3forms.com/submit) for direct email delivery.
 * Features a floating toast notification that auto-dismisses after 2.5 seconds.
 */
export function Feedback({onEnter, initialToast}: FeedbackProps) {
  const ref = useReveals<HTMLElement>();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Bug Report');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastNotification | null>(initialToast ?? null);
  const [isExiting, setIsExiting] = useState(false);

  const dismissTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const clearToastTimers = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  const triggerToast = (type: 'success' | 'error' | 'unconfigured', message: string, detail?: string) => {
    // Clear any existing timeout when a new notification appears so notifications do not conflict
    clearToastTimers();
    setIsExiting(false);
    setToast({type, message, detail});

    // Start subtle fade-out and upward movement at 2200ms (300ms transition before 2500ms dismissal)
    exitTimerRef.current = window.setTimeout(() => {
      setIsExiting(true);
    }, 2200);

    // Automatically dismiss the notification after exactly 2.5 seconds (2500ms)
    dismissTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setIsExiting(false);
    }, 2500);
  };

  useEffect(() => {
    if (initialToast) {
      exitTimerRef.current = window.setTimeout(() => {
        setIsExiting(true);
      }, 2200);

      dismissTimerRef.current = window.setTimeout(() => {
        setToast(null);
        setIsExiting(false);
      }, 2500);
    }
    return () => {
      clearToastTimers();
    };
  }, [initialToast]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent duplicate submissions while request is processing
    if (isSubmitting) return;

    // Field validation
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const trimmedEmail = email.trim();

    if (!trimmedSubject || !trimmedMessage) {
      triggerToast('error', 'TRANSMISSION FAILED. PLEASE TRY AGAIN.', 'ALL REQUIRED FIELDS MUST BE COMPLETED.');
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      triggerToast('error', 'TRANSMISSION FAILED. PLEASE TRY AGAIN.', 'ENTER A VALID EMAIL ADDRESS OR LEAVE IT BLANK.');
      return;
    }

    // Access key validation
    const accessKey = (
      import.meta.env.VITE_WEB3FORMS_ACCESS_KEY ||
      (typeof window !== 'undefined' && (window as unknown as {__WEB3FORMS_ACCESS_KEY__?: string}).__WEB3FORMS_ACCESS_KEY__) ||
      ''
    ).trim();
    if (!accessKey || accessKey === 'YOUR_ACCESS_KEY_HERE') {
      triggerToast('unconfigured', 'FEEDBACK CHANNEL NOT CONFIGURED.', 'Configure VITE_WEB3FORMS_ACCESS_KEY in your .env file or deployment settings.');
      return;
    }

    setIsSubmitting(true);

    const payload: Web3FormsPayload = {
      access_key: accessKey,
      subject: `[${feedbackType}] ${trimmedSubject}`,
      feedback_type: feedbackType,
      message: trimmedMessage,
      from_name: 'Reality.exe Feedback Channel',
    };

    if (trimmedEmail) {
      payload.email = trimmedEmail;
    }

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) {
        triggerToast('success', 'FEEDBACK TRANSMITTED SUCCESSFULLY.');
        // Clear form only after confirmed successful submission
        setSubject('');
        setMessage('');
        setEmail('');
      } else {
        triggerToast(
          'error',
          'TRANSMISSION FAILED. PLEASE TRY AGAIN.',
          typeof data?.message === 'string' ? data.message : undefined
        );
      }
    } catch {
      triggerToast('error', 'TRANSMISSION FAILED. PLEASE TRY AGAIN.', 'Network error. Check connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field =
    'w-full rounded-[4px] bg-white/[0.04] px-4 py-3.5 text-body text-white ring-1 ring-white/15 outline-none placeholder:text-regolith/40 focus:ring-earth user-invalid:ring-red-400/70 transition-colors';

  return (
    <section
      ref={ref}
      id="feedback"
      aria-labelledby="feedback-title"
      className="relative overflow-hidden bg-void px-4 pb-28 sm:px-6 md:px-[6vw] md:pb-40"
    >
      {/* Anchor alias for backwards-compatibility */}
      <span id="reserve" className="sr-only" aria-hidden="true" />

      {/* Atmospheric planetary background element preserved exactly from original design */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[62vw] left-1/2 size-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(111,182,255,0.35),rgba(111,182,255,0.05)_55%,transparent_70%)]"
      />

      <div className="relative grid gap-12 border-t border-white/10 pt-20 md:grid-cols-2 md:gap-16 md:pt-28">
        {/* LEFT SIDE */}
        <div data-reveal>
          <p className="font-mono text-label text-earth uppercase">{feedbackContent.eyebrow}</p>
          <h2 id="feedback-title" className="mt-4 font-display text-display text-white">
            {feedbackContent.heading}
          </h2>
          <p className="mt-5 max-w-[28rem] text-body text-regolith/70">{feedbackContent.body}</p>

          {onEnter && (
            <div className="mt-10">
              <button
                type="button"
                onClick={onEnter}
                className="inline-flex items-center gap-3 rounded-[4px] bg-earth px-6 py-4 font-mono text-label text-void uppercase tracking-[0.2em] font-semibold transition-colors hover:bg-white cursor-pointer"
              >
                <span>Launch 3D Universe Now</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT SIDE — Feedback Form Area */}
        <div className="relative">
          {/* Floating Pop-up Toast Notification at Right Bottom */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`pointer-events-none fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5 rounded-[4px] px-3.5 py-2.5 backdrop-blur-md transition-all duration-300 max-w-[calc(100vw-2rem)] sm:max-w-md ${
                isExiting
                  ? 'opacity-0 -translate-y-2 ease-in'
                  : 'opacity-100 translate-y-0 ease-out shadow-2xl shadow-black/80'
              } ${
                toast.type === 'success'
                  ? 'border border-emerald-400/40 bg-[#05070c]/95 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.18)]'
                  : toast.type === 'unconfigured'
                  ? 'border border-amber-400/40 bg-[#05070c]/95 text-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.18)]'
                  : 'border border-red-400/40 bg-[#05070c]/95 text-red-300 shadow-[0_0_20px_rgba(248,113,113,0.18)]'
              }`}
            >
              {/* Status indicator icon */}
              {toast.type === 'success' ? (
                <span className="flex items-center justify-center shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </span>
              ) : toast.type === 'unconfigured' ? (
                <span className="flex items-center justify-center shrink-0">
                  <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                </span>
              ) : (
                <span className="flex items-center justify-center shrink-0">
                  <span className="size-1.5 rounded-full bg-red-400 shadow-[0_0_8px_#f87171]" />
                </span>
              )}

              {/* Monospace Message Content */}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.6875rem] sm:text-[0.75rem] tracking-[0.12em] uppercase font-medium leading-tight break-words">
                  {toast.message}
                </p>
                {toast.detail && (
                  <p className="mt-0.5 font-mono text-[0.625rem] tracking-[0.04em] text-white/70 break-words">
                    {toast.detail}
                  </p>
                )}
              </div>
            </div>
          )}

          <form noValidate onSubmit={onSubmit} className="space-y-3" data-reveal>
            {/* 1. FEEDBACK TYPE */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Feedback Type</span>
              <div className="relative">
                <select
                  name="feedbackType"
                  required
                  value={feedbackType}
                  disabled={isSubmitting}
                  onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                  className={`${field} appearance-none pr-10 cursor-pointer disabled:opacity-50`}
                >
                  <option value="Bug Report" className="bg-void text-white">
                    Bug Report
                  </option>
                  <option value="Feature Request" className="bg-void text-white">
                    Feature Request
                  </option>
                  <option value="General Feedback" className="bg-void text-white">
                    General Feedback
                  </option>
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[0.625rem] text-regolith/60"
                >
                  ▼
                </span>
              </div>
            </label>

            {/* 2. SUBJECT */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Subject</span>
              <input
                name="subject"
                required
                value={subject}
                disabled={isSubmitting}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What would you like to share?"
                className={`${field} disabled:opacity-50`}
              />
            </label>

            {/* 3. MESSAGE */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Message</span>
              <textarea
                name="message"
                required
                rows={4}
                value={message}
                disabled={isSubmitting}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your feedback..."
                className={`${field} resize-none disabled:opacity-50`}
              />
            </label>

            {/* 4. EMAIL (OPTIONAL) */}
            <label className="block">
              <span className="mb-1.5 block font-mono text-label text-regolith/60 uppercase">Email (Optional)</span>
              <input
                name="email"
                type="email"
                value={email}
                disabled={isSubmitting}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${field} disabled:opacity-50`}
              />
            </label>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-[4px] bg-white px-5 py-4 font-mono text-label text-void uppercase tracking-[0.14em] font-medium transition-colors hover:bg-earth cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'TRANSMITTING...' : 'TRANSMIT FEEDBACK →'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export const Reserve = Feedback;
export default Feedback;
