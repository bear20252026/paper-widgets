import { useEffect, useRef, useState } from 'react';
import './contact.css';

const SITE_URL = 'https://chirostudio.xyz';
const X_URL = 'https://x.com/chirovisuals';
const REPO_URL = 'https://github.com/achrefelouafi/vessel-threejs-showcase';

const STORE_KEY = 'chiro.vessel.contact.collapsed';
const ROOM_QUERY = '(min-width: 760px) and (min-height: 640px)';
const DRAWER_GAP = 12;

function readInitialCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // ignore storage errors in private mode
  }
  return typeof window !== 'undefined' ? !window.matchMedia(ROOM_QUERY).matches : false;
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORE_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconSite() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.4 9h17.2M3.4 15h17.2" />
      <path d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3z" />
    </svg>
  );
}

function IconGo() {
  return (
    <svg
      className="contact__go"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

interface ContactCardProps {
  accent?: string;
  hidden?: boolean;
}

export function ContactCard({ accent = '#d88557', hidden = false }: ContactCardProps) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  };

  // Dynamically inform the right-hand inspector drawer how much room to leave at the bottom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const updateClearance = () => {
      if (hidden) {
        document.documentElement.style.setProperty('--contact-clear', '16px');
        return;
      }
      const bottom = parseFloat(getComputedStyle(el).bottom) || 16;
      const clear = el.offsetHeight + bottom + DRAWER_GAP;
      document.documentElement.style.setProperty('--contact-clear', `${clear}px`);
    };

    updateClearance();
    const ro = new ResizeObserver(updateClearance);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--contact-clear', '16px');
    };
  }, [collapsed, hidden]);

  return (
    <aside
      ref={wrapRef}
      id="contact"
      className={`contact-wrap is-ready ${collapsed ? 'is-collapsed' : ''} ${hidden ? 'is-hidden' : ''}`}
      style={{ '--contact-accent': accent } as React.CSSProperties}
      aria-label="About the author"
    >
      <div className="contact">
        <button
          className="contact__toggle"
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Show the contact card' : 'Hide the contact card'}
          title={collapsed ? 'Work with me' : 'Hide'}
        >
          <span className="contact__toggle-bar" />
        </button>

        <div className="contact__head">
          <div className="contact__portrait">
            <span className="contact__frame">
              <img
                src={`${import.meta.env.BASE_URL}contact/p.jpg`}
                alt="Portrait of Chiro"
                decoding="async"
                draggable={false}
              />
            </span>
          </div>
          <div className="contact__who">
            <span className="contact__status">
              <i />
              Available for work
            </span>
            <span className="contact__name">Chiro</span>
            <span className="contact__role">Creative dev &mdash; 3D, motion, games</span>
          </div>
        </div>

        <div className="contact__rule">
          <b />
        </div>

        <p className="contact__note">
          Blender geometry nodes, evaluated live in three.js. Your building could be next.
        </p>

        <div className="contact__links">
          <a
            className="contact__link contact__link--code"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="contact__icon">
              <IconGitHub />
            </span>
            <span className="contact__link-text">
              <b>Get the source code</b>
              <em>Open source &middot; MIT &middot; GitHub</em>
            </span>
            <IconGo />
          </a>

          <a
            className="contact__link contact__link--x"
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="contact__icon">
              <IconX />
            </span>
            <span className="contact__link-text">
              <b>@chirovisuals</b>
              <em>Work in motion, daily</em>
            </span>
            <IconGo />
          </a>

          <a
            className="contact__link contact__link--site"
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="contact__icon">
              <IconSite />
            </span>
            <span className="contact__link-text">
              <b>chirostudio.xyz</b>
              <em>Portfolio &amp; contact</em>
            </span>
            <IconGo />
          </a>
        </div>
      </div>

      <a
        className="contact__code-pill"
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get the source code on GitHub"
      >
        <IconGitHub />
        <span>Get the code</span>
      </a>
    </aside>
  );
}
