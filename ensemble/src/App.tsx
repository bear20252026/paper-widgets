import React, { useCallback, useEffect, useRef, useState } from 'react';
import { STICKERS } from './stickers.js';
import { initStudio } from './studio';
import type { StudioKeyHooks } from './types';

const WELCOME_STICKERS: Array<[string, string, string, string, number]> = [
  ['grand_piano', '9%', '22%', '-10deg', 40],
  ['saxophone', '8%', '54%', '9deg', 110],
  ['violin', '11%', '82%', '-6deg', 180],
  ['trumpet', '91%', '20%', '8deg', 80],
  ['harp', '92%', '52%', '-9deg', 150],
  ['drum_kit', '89%', '81%', '7deg', 220],
];

const BANNER_DISMISSED_KEY = 'ensemble.pricing_banner.dismissed';

export function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(true);
  const [welcomeLeaving, setWelcomeLeaving] = useState<boolean>(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(true);

  const hasApiKeyRef = useRef<boolean>(false);
  const studioRef = useRef<ReturnType<typeof initStudio> | null>(null);
  const pickerInFlightRef = useRef<Promise<boolean> | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const updateHasApiKey = useCallback((val: boolean) => {
    hasApiKeyRef.current = val;
    setHasApiKey(val);
  }, []);

  const openApiKeyPicker = useCallback(async (): Promise<boolean> => {
    if (pickerInFlightRef.current) return pickerInFlightRef.current;

    const task = (async () => {
      if (window.aistudio?.openSelectKey) {
        try {
          await window.aistudio.openSelectKey();
          // Optimistically assume key selection succeeded to mitigate race conditions.
          updateHasApiKey(true);
          return true;
        } catch (err) {
          console.error('openSelectKey failed:', err);
          studioRef.current?.toast('Could not open the API key selector.', true);
          return false;
        }
      }

      // Fallback when running outside AI Studio iframe
      try {
        const res = await fetch('/api/key-status');
        if (res.ok) {
          const data = await res.json();
          if (data?.hasKey) {
            updateHasApiKey(true);
            studioRef.current?.toast('Using server Gemini API key.');
            return true;
          }
        }
      } catch (err) {
        console.warn('[api/key-status] status check failed:', err);
      }

      studioRef.current?.toast('Configure a paid Gemini API key in AI Studio Secrets.', true);
      return false;
    })();

    pickerInFlightRef.current = task;
    try {
      return await task;
    } finally {
      pickerInFlightRef.current = null;
    }
  }, [updateHasApiKey]);

  const ensureApiKey = useCallback(async (): Promise<boolean> => {
    if (window.aistudio?.hasSelectedApiKey) {
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) {
          updateHasApiKey(true);
          return true;
        }
        updateHasApiKey(false);
        return await openApiKeyPicker();
      } catch (err) {
        console.warn('[aistudio] hasSelectedApiKey check failed:', err);
      }
    }

    if (!hasApiKeyRef.current) {
      return await openApiKeyPicker();
    }
    return true;
  }, [openApiKeyPicker, updateHasApiKey]);

  const onApiKeyError = useCallback(
    async (message: string) => {
      updateHasApiKey(false);
      const shortMsg = message
        ? `API key issue: ${message.slice(0, 90)}`
        : 'Please select a valid paid Gemini API key.';
      studioRef.current?.toast(shortMsg, true);
      await openApiKeyPicker();
    },
    [openApiKeyPicker, updateHasApiKey]
  );

  // Initialize Ensemble studio engine once DOM is mounted
  useEffect(() => {
    const hooks: StudioKeyHooks = {
      ensureApiKey,
      onApiKeyError,
      openApiKeyPicker: async () => {
        await openApiKeyPicker();
      },
      getHasApiKey: () => hasApiKeyRef.current,
    };
    const instance = initStudio(hooks);
    studioRef.current = instance;
    return () => {
      instance.dispose();
      studioRef.current = null;
    };
  }, [ensureApiKey, onApiKeyError, openApiKeyPicker]);

  const dismissWelcome = useCallback(() => {
    studioRef.current?.playOpenSfx();
    setWelcomeLeaving(true);
    setTimeout(() => {
      setWelcomeOpen(false);
      setWelcomeLeaving(false);
    }, 350);
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {}
  }, []);

  useEffect(() => {
    const applyOffset = (px: number) => {
      document.documentElement.style.setProperty('--banner-offset', `${px}px`);
      studioRef.current?.relayout();
    };

    if (bannerDismissed) {
      applyOffset(0);
      return;
    }

    const el = bannerRef.current;
    if (!el) {
      applyOffset(40);
      return;
    }

    const syncHeight = () => {
      const h = Math.ceil(el.getBoundingClientRect().height) || 40;
      applyOffset(h);
    };
    syncHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(syncHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [bannerDismissed]);

  return (
    <>
      {!bannerDismissed && (
        <div
          ref={bannerRef}
          className="pricing-banner"
          role="region"
          aria-label="Model pricing notice"
        >
          <div className="pricing-banner-left">
            <svg
              className="pricing-banner-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0b57d0"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9.5" />
              <path d="M12 11v5.5" strokeLinecap="round" />
              <circle cx="12" cy="7.5" r="0.9" fill="#0b57d0" stroke="none" />
            </svg>
            <p className="pricing-banner-text">
              This app uses <strong>genie-4</strong>, a premium model. Usage is billed to your API
              key at ~$6.06 per minute.{' '}
              <a
                className="pricing-banner-link"
                href="https://ai.google.dev/gemini-api/docs/pricing"
                target="_blank"
                rel="noopener noreferrer"
              >
                See pricing
              </a>
            </p>
          </div>
          <button
            type="button"
            className="pricing-banner-close"
            onClick={dismissBanner}
            aria-label="Dismiss pricing notice"
            title="Dismiss"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div id="world">
        <div id="stickers" />
      </div>
      <div className="vignette" />

      {welcomeOpen && (
        <section
          id="welcome"
          className={welcomeLeaving ? 'leaving' : undefined}
          aria-labelledby="welcome-title"
        >
          <div className="welcome-deco" id="welcome-stickers" aria-hidden="true">
            {WELCOME_STICKERS.map(([id, left, top, rot, delay]) =>
              STICKERS[id] ? (
                <img
                  key={id}
                  className="welcome-sticker"
                  src={STICKERS[id]}
                  alt=""
                  draggable={false}
                  style={
                    {
                      left,
                      top,
                      '--r': rot,
                      animationDelay: `${delay}ms`,
                    } as React.CSSProperties
                  }
                />
              ) : null
            )}
          </div>
          <div className="welcome-card">
            <h2 id="welcome-title">Ensemble</h2>
            <p className="welcome-lead">
              Build a band from stickers and set it on a paper stage.
            </p>

            <div className="welcome-steps">
              <div className="welcome-step">
                <h3>Place your stickers</h3>
                <p>Click anywhere or roll the dice to add instruments, vocals, and beats.</p>
              </div>
              <div className="welcome-step">
                <h3>Shape the feel</h3>
                <p>Pick a genre and venue, then dial in tempo, energy, and mood.</p>
              </div>
              <div className="welcome-step">
                <h3>Perform &amp; steer</h3>
                <p>Stream live video and sound—and tweak stickers or faders mid-song.</p>
              </div>
            </div>

            <div className="welcome-key-box">
              <div className="welcome-key-status">
                <span className={`dot${hasApiKey ? ' ok' : ''}`} />
                <div>
                  <span className="welcome-label">Static shelf cut</span>
                  <p className="welcome-help">
                    The sticker board and arrangement are fully interactive. Live Genie 4 performance needs its Gemini server.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="welcome-btn"
                id="btn-enter"
                onClick={dismissWelcome}
              >
                <span>Enter the Stage</span>
                <span className="welcome-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      <header>
        <div className="brand">
          <h1>Ensemble</h1>
        </div>
        <div className="hdr-r">
          <button type="button" className="pill" id="btn-model">
            <span className={`dot${hasApiKey ? ' ok' : ''}`} />
            <span id="modelname">Genie 4</span>
          </button>
          <button
            type="button"
            className="iconbtn"
            id="btn-settings"
            title="Settings"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div id="chipbar" className="ui">
        <div className="tabs" id="tabs">
          <button type="button" data-tab="genre" className="on">
            Genre<sup />
          </button>
          <button type="button" data-tab="venue">
            Venue<sup />
          </button>
          <button type="button" data-tab="era">
            Era<sup />
          </button>
        </div>
        <div className="chips" id="chips" />
        <button
          type="button"
          className="iconbtn"
          id="btn-dice"
          title="Roll the dice — add random instruments"
          aria-label="Roll the dice — add random instruments"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
            <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" />
            <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="iconbtn"
          id="btn-clear"
          title="Clear the stage"
          aria-label="Clear the stage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </div>

      <div id="frame" data-phase="idle">
        <canvas id="video" width={1280} height={720} />
        <div className="scrim" />
        <canvas id="spec" />

        <div className="layer idle">
          <div className="begin-wrap">
            <div className="halo" />
            <button type="button" className="begin" id="btn-begin" disabled>
              <span className="play">
                <svg viewBox="0 0 12 12">
                  <path d="M2 1l9 5-9 5z" fill="currentColor" />
                </svg>
              </span>
              Begin Performance
            </button>
          </div>
          <div className="summary" id="summary" />
          <div className="cast" id="cast" />
        </div>

        <div className="layer connecting">
          <div className="eq">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="status" id="status">
            Tuning up…
          </div>
          <div className="substatus" id="substatus">
            Connecting to Genie 4
          </div>
          <button type="button" className="ghostbtn" id="btn-cancel">
            Cancel
          </button>
        </div>

        <div className="layer live">
          <div className="live-top">
            <span className="badge-live">
              <i />
              LIVE · <span id="live-model">GENIE 4</span>
            </span>
            <div className="timer">
              <svg viewBox="0 0 46 46">
                <circle cx="23" cy="23" r="21" stroke="rgba(255,255,255,.15)" />
                <circle
                  id="ring"
                  cx="23"
                  cy="23"
                  r="21"
                  stroke="#f0b46a"
                  strokeLinecap="round"
                  strokeDasharray="131.95"
                  strokeDashoffset="0"
                />
              </svg>
              <span id="clock">1:00</span>
            </div>
          </div>
          <div className="live-bot">
            <div className="cues" id="cues" />
            <button type="button" className="stopbtn" id="btn-stop">
              <i />
              End
            </button>
          </div>
        </div>

        <div className="layer ended">
          <div className="overline">Curtain</div>
          <div className="bravo">Bravo.</div>
          <div className="endmeta" id="endmeta" />
          <div className="endrow">
            <button type="button" className="solid" id="btn-encore">
              ↻ Encore
            </button>
            <button type="button" className="outline" id="btn-save" disabled>
              ↓ Save recording
            </button>
            <button type="button" className="outline" id="btn-back">
              New stage
            </button>
          </div>
        </div>

        <div className="layer error">
          <div className="errtitle">Performance needs its server.</div>
          <div className="errmsg" id="errmsg" />
          <div className="endrow">
            <button type="button" className="solid" id="btn-retry">
              Try again
            </button>
            <button type="button" className="outline" id="btn-err-settings">
              Settings
            </button>
            <button type="button" className="outline" id="btn-err-back">
              Back
            </button>
          </div>
        </div>
      </div>

      <div id="faders" className="ui" />

      <section id="drawer" className="ui">
        <div className="dr-bar" id="dr-bar">
          <span className="dr-label">✦ Prompt</span>
          <span id="dr-preview" />
          <span id="dr-meta" />
          <span className="chev">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </div>
        <div className="dr-body">
          <div className="dr-inner">
            <div className="dr-tabs">
              <button type="button" data-p="composed" className="on">
                Composed<span className="editedbadge">· EDITED</span>
              </button>
              <button type="button" data-p="director">
                Director · Gemini
              </button>
              <button type="button" data-p="live">
                Live cues
              </button>
              <span className="sp" />
              <button type="button" className="act" id="dr-reset" hidden>
                Reset
              </button>
              <button type="button" className="act" id="dr-edit">
                Edit
              </button>
              <button type="button" className="act" id="dr-copy">
                Copy
              </button>
            </div>
            <div className="dr-pane on" data-p="composed">
              <div id="dr-text" spellCheck={false} />
              <div className="legend" id="legend" />
            </div>
            <div className="dr-pane" data-p="director">
              <div id="dr-dir" className="empty">
                When the performance begins, Gemini acts as music director — rewriting the composed
                prompt into a vivid one-minute scene for Genie 4. Toggle this in settings.
              </div>
            </div>
            <div className="dr-pane" data-p="live">
              <ol id="dr-live" />
            </div>
          </div>
        </div>
      </section>

      <div className="pop" id="pop" hidden>
        <div className="pop-head" id="pop-head" />
        <div className="pop-in">
          <span className="spark">✦</span>
          <input
            id="pop-input"
            placeholder="Conjure an instrument, beat, voice, mood…"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>↵</kbd>
        </div>
        <div className="pop-list" id="pop-list" />
        <div className="pop-foot">
          <span>↑↓ choose · ⇥ category</span>
          <span>esc</span>
        </div>
      </div>

      <div className="modal-bg" id="modal" hidden>
        <div className="modal">
          <h2>Backstage</h2>
          <p className="sub" id="modal-sub">
            Configure the performance model, length, and backstage features.
          </p>
          <div className="field">
            <label htmlFor="set-model">Performance model</label>
            <select id="set-model" defaultValue="genie-4">
              <option value="genie-4">Genie 4</option>
            </select>
          </div>
          <div className="field">
            <label>Performance length</label>
            <div className="seg3" id="set-len">
              <button type="button" data-v="30">
                30s
              </button>
              <button type="button" data-v="60">
                60s
              </button>
              <button type="button" data-v="90">
                90s
              </button>
            </div>
          </div>
          <div className="toggle">
            <div>
              Gemini music director
              <small>Rewrites your prompt into a vivid scene before the curtain rises.</small>
            </div>
            <button type="button" className="switch" id="set-director" aria-label="Toggle Gemini music director" />
          </div>
          <div className="toggle">
            <div>
              Paint custom stickers
              <small>Nano Banana illustrates anything you conjure that isn't in the sticker box.</small>
            </div>
            <button type="button" className="switch" id="set-paint" aria-label="Toggle Paint custom stickers" />
          </div>
          <div className="toggle">
            <div>
              Sticker sounds
              <small>Soft plucks when you place instruments.</small>
            </div>
            <button type="button" className="switch" id="set-sfx" aria-label="Toggle Sticker sounds" />
          </div>
          <div className="row">
            <button type="button" className="outline" id="set-cancel">
              Close
            </button>
            <button type="button" className="solid" id="set-save">
              Save
            </button>
          </div>
        </div>
      </div>

      <div id="toasts" />
      <div className="hint" id="hint">
        <b>Click anywhere</b> to add an instrument, beat or voice · or roll the dice 🎲
      </div>
    </>
  );
}

export default App;
