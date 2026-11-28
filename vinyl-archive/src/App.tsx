import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Headphones,
  Pause,
  Play,
  Plus,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import ArchiveScene from "./components/ArchiveScene";
import { INITIAL_RELEASE, releases, wrapIndex } from "./data/releases";
import { getArtwork, type Artwork } from "./lib/artwork";
import { ArchiveAudio, type AudioSelection } from "./lib/audio";

type Mode = "archive" | "opening" | "release";
type Panel = "releases" | "artists" | "radio" | "menu" | "collection" | null;

function initialPosition() {
  const id = window.location.hash.replace("#release/", "").toUpperCase();
  const index = releases.findIndex((release) => release.id === id);
  return index < 0 ? INITIAL_RELEASE : index;
}

function readSaved(): string[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem("sable-collection") || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function RecordMark({ className = "" }: { className?: string }) {
  return (
    <span className={`record-mark ${className}`} aria-hidden="true">
      <span />
    </span>
  );
}

function Equalizer() {
  return (
    <span className="equalizer" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function App() {
  const [position, setPosition] = useState(initialPosition);
  const [mode, setMode] = useState<Mode>(() =>
    window.location.hash.startsWith("#release/") ? "release" : "archive",
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All sounds");
  const [audioSelection, setAudioSelection] = useState<AudioSelection | null>(
    null,
  );
  const [progress, setProgress] = useState(0);
  const [audio] = useState(() => new ArchiveAudio());
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimeout = useRef<number | undefined>(undefined);
  const playStarted = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const selected = wrapIndex(position);
  const release = releases[selected];
  const playingThis = audioSelection?.release === selected;

  useEffect(() => {
    void getArtwork().then(setArtwork);
  }, []);
  useEffect(
    () => () => {
      audio.dispose();
      window.clearTimeout(toastTimeout.current);
    },
    [audio],
  );
  useEffect(() => {
    try {
      localStorage.setItem("sable-collection", JSON.stringify(saved));
    } catch {
      /* Browsing still works without storage. */
    }
  }, [saved]);
  useEffect(() => {
    document.title =
      mode === "release"
        ? `${release.title} - ${release.artist} / Sable`
        : "Sable - The Disc Archive";
  }, [mode, release]);
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const alignYear = () => {
      if (window.innerWidth > 540) {
        timeline.scrollLeft = 0;
        return;
      }
      const year = timeline.children[selected] as HTMLElement | undefined;
      if (year)
        timeline.scrollTo({
          left:
            year.offsetLeft - timeline.clientWidth / 2 + year.clientWidth / 2,
          behavior: "smooth",
        });
    };
    alignYear();
    window.addEventListener("resize", alignYear);
    return () => window.removeEventListener("resize", alignYear);
  }, [selected, mode]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const browse = useCallback(
    (direction: number) => setPosition((current) => current + direction),
    [],
  );
  const choose = useCallback((index: number) => {
    setPosition((current) => {
      let difference = index - wrapIndex(current);
      if (difference > releases.length / 2) difference -= releases.length;
      if (difference < -releases.length / 2) difference += releases.length;
      return current + difference;
    });
  }, []);

  const completeOpen = useCallback(() => {
    setMode("release");
    setNotesOpen(false);
    window.history.pushState(
      null,
      "",
      `#release/${releases[wrapIndex(position)].id.toLowerCase()}`,
    );
  }, [position]);

  const openRelease = useCallback(() => {
    if (mode !== "archive" || panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      completeOpen();
    else setMode("opening");
  }, [mode, panel, completeOpen]);

  const backToArchive = useCallback(() => {
    setMode("archive");
    setPanel(null);
    if (window.location.hash) {
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  useEffect(() => {
    const onRoute = () => {
      if (window.location.hash.startsWith("#release/")) {
        choose(initialPosition());
        setMode("release");
      } else setMode("archive");
      setPanel(null);
    };
    window.addEventListener("popstate", onRoute);
    window.addEventListener("hashchange", onRoute);
    return () => {
      window.removeEventListener("popstate", onRoute);
      window.removeEventListener("hashchange", onRoute);
    };
  }, [choose]);

  const playPreview = useCallback(
    async (releaseIndex: number, track = 0, radio = false) => {
      if (
        audioSelection?.release === releaseIndex &&
        audioSelection.track === track &&
        audioSelection.radio === radio
      ) {
        audio.stop();
        setAudioSelection(null);
        setProgress(0);
        return;
      }
      try {
        const started = await audio.play(releaseIndex, track);
        if (!started) return;
        playStarted.current = performance.now();
        setProgress(0);
        setAudioSelection({ release: releaseIndex, track, radio });
      } catch {
        notify(
          "Audio could not start. Please try again in a supported browser.",
        );
      }
    },
    [audio, audioSelection, notify],
  );

  useEffect(() => {
    if (!audioSelection) return;
    const interval = window.setInterval(() => {
      const seconds = (performance.now() - playStarted.current) / 1000;
      setProgress(Math.min(30, seconds));
      if (seconds >= 30) {
        if (audioSelection.radio)
          void playPreview(wrapIndex(audioSelection.release + 1), 0, true);
        else {
          audio.stop();
          setAudioSelection(null);
          setProgress(0);
        }
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [audioSelection, audio, playPreview]);

  const toggleSaved = () => {
    const exists = saved.includes(release.id);
    setSaved((current) =>
      exists
        ? current.filter((id) => id !== release.id)
        : [...current, release.id],
    );
    notify(
      exists
        ? "Release removed from your collection."
        : "A good find. Saved to your collection.",
    );
  };

  const toggleReleasePreview = () => {
    if (playingThis) {
      audio.stop();
      setAudioSelection(null);
      setProgress(0);
    } else void playPreview(selected);
  };

  const openPanel = (next: Panel) => {
    if (!panel) panelTrigger.current = document.activeElement as HTMLElement;
    setSearch("");
    setFilter("All sounds");
    setPanel((current) => (current === next ? null : next));
  };

  const closePanel = useCallback(() => {
    setPanel(null);
    window.setTimeout(() => panelTrigger.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!panel) return;
    const timer = window.setTimeout(
      () =>
        dialogRef.current?.querySelector<HTMLElement>("button, input")?.focus(),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [panel]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "Escape") {
        if (panel) closePanel();
        else if (mode === "release") backToArchive();
      }
      if (panel && event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button, input, a[href]",
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        panel ||
        mode !== "archive"
      )
        return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        browse(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        browse(-1);
      }
      if (
        event.key === "Enter" &&
        (target === document.body || target.classList.contains("scene-host"))
      )
        openRelease();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, mode, browse, openRelease, closePanel, backToArchive]);

  const selectFromPanel = (index: number) => {
    choose(index);
    backToArchive();
  };

  const nextDetail = () => {
    const next = wrapIndex(position + 1);
    browse(1);
    setNotesOpen(false);
    window.history.pushState(
      null,
      "",
      `#release/${releases[next].id.toLowerCase()}`,
    );
    document
      .querySelector(".release-page")
      ?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredReleases = releases
    .map((item, index) => ({ ...item, index }))
    .filter((item) => {
      const matchesSearch =
        `${item.title} ${item.artist} ${item.id} ${item.year}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesGenre =
        filter === "All sounds" ||
        (filter === "Ambient" &&
          item.genre.toLowerCase().includes("ambient")) ||
        (filter === "Jazz" && item.genre.toLowerCase().includes("jazz")) ||
        (filter === "Electronic" &&
          ["electronica", "downtempo", "leftfield", "experimental"].includes(
            item.genre.toLowerCase(),
          ));
      return (
        matchesSearch &&
        matchesGenre &&
        (panel !== "collection" || saved.includes(item.id))
      );
    });

  return (
    <div
      className={`archive-app ${mode === "opening" ? "is-opening" : ""} ${mode === "release" ? "is-detail" : ""}`}
    >
      <header className="site-header" inert={!!panel || mode === "opening"}>
        <button
          className="brand"
          onClick={backToArchive}
          aria-label="Sable, return to the archive"
        >
          <RecordMark />
          <span>Sable</span>
        </button>
        <div className="archive-wordmark">
          <span className="short-rule" />
          <span>DISC ARCHIVE</span>
        </div>
        <div className="on-platter" aria-live="polite">
          <span className="status-dot orange" />
          <span>ON THE PLATTER</span>
          <span className="short-rule" />
          <span className="platter-title">
            {release.id} {release.title}
          </span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={panel === "releases" ? "nav-active" : ""}
            onClick={() => openPanel("releases")}
          >
            Releases
          </button>
          <button
            className={panel === "artists" ? "nav-active" : ""}
            onClick={() => openPanel("artists")}
          >
            Artists
          </button>
          <button
            className={panel === "radio" ? "nav-active" : ""}
            onClick={() => openPanel("radio")}
          >
            Radio{audioSelection?.radio && <span className="radio-live-dot" />}
          </button>
        </nav>
        <button
          className={`menu-toggle ${panel === "menu" ? "menu-open" : ""}`}
          onClick={() => openPanel("menu")}
          aria-label="Open archive menu"
          aria-expanded={panel === "menu"}
        >
          <span />
          <span />
        </button>
      </header>

      <main
        className={`archive-view ${mode === "release" ? "archive-hidden" : ""}`}
        aria-hidden={mode === "release"}
        inert={!!panel || mode === "opening" || mode === "release"}
      >
        <section className="archive-stage" aria-label="The disc archive">
          {artwork ? (
            <ArchiveScene
              artwork={artwork}
              selected={position}
              opening={mode === "opening"}
              active={mode !== "release" && !panel}
              onBrowse={browse}
              onSelect={choose}
              onOpen={openRelease}
              onOpenComplete={completeOpen}
            />
          ) : (
            <div className="archive-loading">
              <RecordMark />
              <span>SETTING THE PLATTER</span>
            </div>
          )}
          <div className="stage-hint hint-left">
            <span className="drag-line" />
            DRAG TO EXPLORE
          </div>
          <button className="stage-hint hint-right" onClick={openRelease}>
            CLICK A SLEEVE TO OPEN <ArrowUpRight size={13} />
          </button>
        </section>
        <section className="release-selector" aria-label="Selected release">
          <button
            className="browse-button previous"
            onClick={() => browse(-1)}
            aria-label="Previous release"
            disabled={mode === "opening"}
          >
            <ArrowLeft size={25} strokeWidth={1.4} />
          </button>
          <button
            className="selected-release"
            onClick={openRelease}
            disabled={mode === "opening"}
            aria-label={`Open ${release.title} by ${release.artist}`}
          >
            <span className="release-category">
              <span
                className="status-dot"
                style={{ background: release.accent }}
              />
              {release.id}
              <span className="meta-dash">/</span>
              {release.genre}
            </span>
            <h1 key={release.id}>
              {release.title}
              <ArrowUpRight
                className="open-release-arrow"
                size={18}
                strokeWidth={1.3}
              />
            </h1>
            <span className="release-artist">
              {release.artist}, {release.year}
            </span>
          </button>
          <button
            className="browse-button next"
            onClick={() => browse(1)}
            aria-label="Next release"
            disabled={mode === "opening"}
          >
            <ArrowRight size={25} strokeWidth={1.4} />
          </button>
        </section>
        <section
          className="archive-timeline"
          aria-label="Browse releases by year"
          ref={timelineRef}
        >
          {releases.map((item, index) => (
            <button
              key={item.id}
              className={`timeline-year ${index <= selected ? "year-past" : ""} ${index === selected ? "year-selected" : ""}`}
              onClick={() => choose(index)}
              aria-label={`${item.year}: ${item.title}`}
              aria-current={selected === index ? "true" : undefined}
              disabled={mode === "opening"}
            >
              <span className="wave-bars" aria-hidden="true">
                {Array.from({ length: 10 }, (_, bar) => (
                  <i
                    key={bar}
                    style={{
                      height: `${bar === 5 ? 39 : 7 + ((index * 17 + bar * 13 + Math.round(Math.sin(index + bar * 1.6) * 10) + 100) % 28)}px`,
                    }}
                  />
                ))}
              </span>
              <span className="year-marker" />
              <span className="year-label">
                {[0, 3, 6, 9, 10, 12, 15].includes(index)
                  ? item.year
                  : `'${String(item.year).slice(2)}`}
              </span>
            </button>
          ))}
        </section>
      </main>

      {mode === "release" && (
        <main className="release-page" inert={!!panel}>
          <div className="detail-topline">
            <button className="text-link back-link" onClick={backToArchive}>
              <ArrowLeft size={16} />
              BACK TO THE ARCHIVE
            </button>
            <span>
              {String(selected + 1).padStart(2, "0")} /{" "}
              {String(releases.length).padStart(2, "0")} RELEASES
            </span>
          </div>
          <div className="release-layout">
            <div className="release-artwork-column">
              <button
                className={`detail-artwork ${playingThis ? "artwork-playing" : ""}`}
                onClick={toggleReleasePreview}
                aria-label={
                  playingThis ? "Pause release preview" : "Play release preview"
                }
              >
                <div
                  className="detail-disc"
                  style={{ "--disc-label": release.accent } as CSSProperties}
                >
                  <span />
                  <i />
                </div>
                {artwork && (
                  <img
                    src={artwork.images[selected]}
                    alt={`${release.title} by ${release.artist}, original ${release.year} sleeve`}
                  />
                )}
                <span className="artwork-listen">
                  {playingThis ? (
                    <Pause size={18} fill="currentColor" />
                  ) : (
                    <Play size={18} fill="currentColor" />
                  )}
                  <span>
                    {playingThis ? "PAUSE THE PREVIEW" : "A CLOSER LISTEN"}
                  </span>
                </span>
              </button>
              <div className="artwork-caption">
                <span>THE ORIGINAL SLEEVE</span>
                <span>
                  {release.id} / {release.year}
                </span>
              </div>
              <p className="listening-note">
                <Headphones size={15} strokeWidth={1.5} />
                Some records are places. Stay a little while.
              </p>
            </div>
            <div className="release-information">
              <div className="release-category">
                <span
                  className="status-dot"
                  style={{ background: release.accent }}
                />
                {release.id}
                <span className="meta-dash">/</span>
                {release.genre}
                <span className="meta-dash">/</span>
                {release.year}
              </div>
              <h1>{release.title}</h1>
              <p className="detail-artist">{release.artist}</p>
              <p className="release-description">{release.description}</p>
              <div className="release-actions">
                <button
                  className="primary-button"
                  onClick={toggleReleasePreview}
                >
                  {playingThis ? (
                    <Pause size={15} fill="currentColor" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {playingThis ? "Pause preview" : "Listen to the record"}
                </button>
                <button
                  className={`save-button ${saved.includes(release.id) ? "is-saved" : ""}`}
                  onClick={toggleSaved}
                >
                  {saved.includes(release.id) ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                  {saved.includes(release.id)
                    ? "In your collection"
                    : "Save release"}
                </button>
              </div>
              <div className="tracklist">
                <div className="tracklist-heading">
                  <span>THE RECORD</span>
                  <span>4 TRACKS / 12-INCH + DIGITAL</span>
                </div>
                {release.tracks.map((track, index) => {
                  const isPlaying =
                    playingThis && audioSelection?.track === index;
                  return (
                    <button
                      className={`track-row ${isPlaying ? "track-playing" : ""}`}
                      key={`${release.id}-${track.title}`}
                      onClick={() => void playPreview(selected, index)}
                      aria-label={`${isPlaying ? "Pause" : "Play"} ${track.title} preview`}
                    >
                      <span className="track-number">
                        {isPlaying ? (
                          <Equalizer />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="track-title">{track.title}</span>
                      <span className="track-duration">{track.duration}</span>
                      <span className="track-play">
                        {isPlaying ? (
                          <Pause size={13} fill="currentColor" />
                        ) : (
                          <Play size={13} fill="currentColor" />
                        )}
                      </span>
                      {isPlaying && (
                        <span
                          className="track-progress"
                          style={{ width: `${(progress / 30) * 100}%` }}
                        />
                      )}
                    </button>
                  );
                })}
                <p className="preview-disclaimer">
                  Original 30-second ambient listening sketches.
                </p>
              </div>
              <button
                className={`sleeve-notes-toggle ${notesOpen ? "notes-open" : ""}`}
                onClick={() => setNotesOpen(!notesOpen)}
                aria-expanded={notesOpen}
              >
                SLEEVE NOTES
                <ChevronDown size={17} />
              </button>
              {notesOpen && (
                <div className="sleeve-notes">
                  <p>
                    Written and produced by {release.artist}. Recorded with
                    patience, released independently by Sable Records in{" "}
                    {release.year}.
                  </p>
                  <p>
                    Original pressing: 300 copies. Artwork from the Sable
                    studio. A small part of a much bigger story.
                  </p>
                </div>
              )}
              <a
                className="bandcamp-link"
                href={`https://bandcamp.com/search?q=${encodeURIComponent(`${release.artist} ${release.title}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Find the artist on Bandcamp
                <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
          <div className="detail-bottomline">
            <span>INDEPENDENT SOUNDS. LASTING IMPRESSIONS.</span>
            <button onClick={nextDetail}>
              NEXT ON THE SHELF
              <span>{releases[wrapIndex(selected + 1)].title}</span>
              <ArrowRight size={23} />
            </button>
          </div>
        </main>
      )}

      <footer className="site-footer" inert={!!panel || mode === "opening"}>
        <span>&copy; 2026 SABLE RECORDS</span>
        <button
          className={`sound-toggle ${audioSelection ? "sound-playing" : ""}`}
          onClick={() => {
            if (audioSelection) {
              audio.stop();
              setAudioSelection(null);
              setProgress(0);
            } else void playPreview(selected);
          }}
          aria-label={
            audioSelection ? "Turn sound off" : "Listen to an ambient preview"
          }
        >
          {audioSelection ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span>
            {audioSelection
              ? `${releases[audioSelection.release].title.toUpperCase()} / 00:${Math.floor(progress).toString().padStart(2, "0")}`
              : "SOUND OFF"}
          </span>
          {audioSelection && <Equalizer />}
        </button>
        <div className="footer-socials">
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
            INSTAGRAM
            <ArrowUpRight size={11} />
          </a>
          <a href="https://bandcamp.com/" target="_blank" rel="noreferrer">
            BANDCAMP
            <ArrowUpRight size={11} />
          </a>
        </div>
      </footer>

      {panel && (
        <div className="panel-layer">
          <button
            className="panel-backdrop"
            onClick={closePanel}
            aria-label="Close panel"
          />
          <aside
            className={`side-panel panel-${panel}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
            ref={dialogRef}
          >
            <div className="panel-topline">
              <span>
                SABLE /{" "}
                {panel === "menu" ? "INDEPENDENT SINCE 1994" : "THE ARCHIVE"}
              </span>
              <button
                className="close-panel"
                onClick={closePanel}
                aria-label="Close panel"
              >
                <X size={23} strokeWidth={1.4} />
              </button>
            </div>
            {(panel === "releases" || panel === "collection") && (
              <>
                <div className="panel-heading">
                  <span className="eyebrow">
                    {panel === "collection"
                      ? "A PERSONAL SELECTION"
                      : "1994 - 2009"}
                  </span>
                  <h2 id="panel-title">
                    {panel === "collection"
                      ? "Your collection."
                      : "Good records.\nNo expiry date."}
                  </h2>
                  <p>
                    {panel === "collection"
                      ? `${saved.length} ${saved.length === 1 ? "record" : "records"} worth coming back to. Saved on this device.`
                      : "Sixteen releases. A world of their own."}
                  </p>
                </div>
                <label className="search-field">
                  <Search size={17} strokeWidth={1.5} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Find a record, artist, or year"
                    aria-label="Search releases"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <div className="sound-filters" aria-label="Filter by genre">
                  {["All sounds", "Ambient", "Jazz", "Electronic"].map(
                    (item) => (
                      <button
                        className={item === filter ? "filter-active" : ""}
                        onClick={() => setFilter(item)}
                        key={item}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
                <div className="panel-release-list">
                  {filteredReleases.map((item) => (
                    <button
                      className="catalogue-row"
                      key={item.id}
                      onClick={() => selectFromPanel(item.index)}
                    >
                      {artwork && (
                        <img src={artwork.images[item.index]} alt="" />
                      )}
                      <span>
                        <strong>{item.title}</strong>
                        <span>{item.artist}</span>
                      </span>
                      <span className="catalogue-row-meta">
                        {item.id}
                        <span>{item.year}</span>
                      </span>
                      <ArrowUpRight size={17} strokeWidth={1.3} />
                    </button>
                  ))}
                  {filteredReleases.length === 0 && (
                    <div className="empty-state">
                      <Bookmark size={30} strokeWidth={1} />
                      <h3>
                        {panel === "collection" && !saved.length
                          ? "Make yourself a little shelf."
                          : "Nothing in this groove."}
                      </h3>
                      <p>
                        {panel === "collection" && !saved.length
                          ? "Open a release and save the records that find you."
                          : "Try another artist, year, or sound."}
                      </p>
                      {panel === "collection" && !saved.length && (
                        <button
                          className="primary-button"
                          onClick={() => openPanel("releases")}
                        >
                          Explore the releases
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {panel === "artists" && (
              <>
                <div className="panel-heading">
                  <span className="eyebrow">THE PEOPLE BEHIND THE RECORDS</span>
                  <h2 id="panel-title">
                    Singular voices.
                    <br />
                    Shared frequency.
                  </h2>
                  <p>Meet the artists who make Sable sound like Sable.</p>
                </div>
                <div className="artist-list">
                  {releases
                    .map((item, index) => ({ ...item, index }))
                    .sort((a, b) => a.artist.localeCompare(b.artist))
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectFromPanel(item.index)}
                      >
                        <span
                          className="artist-initial"
                          style={{ background: item.color, color: item.ink }}
                        >
                          {item.artist.charAt(0)}
                        </span>
                        <span>
                          <strong>{item.artist}</strong>
                          <span>
                            {item.genre} / {item.year}
                          </span>
                        </span>
                        <ArrowUpRight size={20} strokeWidth={1.3} />
                      </button>
                    ))}
                </div>
              </>
            )}

            {panel === "radio" && (
              <>
                <div className="panel-heading">
                  <span className="eyebrow">
                    <span className="status-dot orange" />
                    TRANSMISSIONS FROM THE SHELF
                  </span>
                  <h2 id="panel-title">Sable Radio.</h2>
                  <p>A little further out. A little closer in.</p>
                </div>
                <div
                  className={`radio-record ${audioSelection?.radio ? "radio-spinning" : ""}`}
                >
                  <span
                    style={{
                      background:
                        releases[
                          audioSelection?.radio
                            ? audioSelection.release
                            : selected
                        ].accent,
                    }}
                  >
                    <RecordMark />
                    <small>
                      SABLE
                      <br />
                      RADIO
                    </small>
                  </span>
                </div>
                <div className="radio-now-playing">
                  <span className="eyebrow">
                    {audioSelection?.radio
                      ? "NOW DRIFTING THROUGH"
                      : "AN OPEN-ENDED LISTENING ROOM"}
                  </span>
                  <h3>
                    {audioSelection?.radio
                      ? releases[audioSelection.release].title
                      : "Let the archive play."}
                  </h3>
                  <p>
                    {audioSelection?.radio
                      ? releases[audioSelection.release].artist
                      : "Original ambient sketches, continuously unfolding."}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() =>
                      void playPreview(
                        audioSelection?.radio
                          ? audioSelection.release
                          : selected,
                        0,
                        true,
                      )
                    }
                  >
                    {audioSelection?.radio ? (
                      <Pause size={15} fill="currentColor" />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                    {audioSelection?.radio
                      ? "Pause the transmission"
                      : "Tune in"}
                  </button>
                </div>
                <div className="radio-queue">
                  <div className="tracklist-heading">
                    <span>IN THE ROTATION</span>
                    <Headphones size={14} />
                  </div>
                  {[10, 1, 4, 9].map((index) => (
                    <button
                      key={index}
                      onClick={() => void playPreview(index, 0, true)}
                    >
                      <span
                        className="status-dot"
                        style={{ background: releases[index].accent }}
                      />
                      <span>
                        {releases[index].title}
                        <small>{releases[index].artist}</small>
                      </span>
                      {audioSelection?.radio &&
                      audioSelection.release === index ? (
                        <Equalizer />
                      ) : (
                        <Play size={13} />
                      )}
                    </button>
                  ))}
                </div>
                <p className="radio-footnote">
                  No algorithms. No hurry. Just follow the sound.
                </p>
              </>
            )}

            {panel === "menu" && (
              <>
                <div className="panel-heading menu-heading">
                  <RecordMark />
                  <h2 id="panel-title">
                    A small label.
                    <br />
                    An open mind.
                  </h2>
                  <p>
                    Independent sounds, carefully collected.
                    <br />
                    Sable is a home for music that takes its time.
                  </p>
                </div>
                <div className="menu-links">
                  <button onClick={() => openPanel("releases")}>
                    The releases<span>01</span>
                    <ArrowUpRight />
                  </button>
                  <button onClick={() => openPanel("artists")}>
                    The artists<span>02</span>
                    <ArrowUpRight />
                  </button>
                  <button onClick={() => openPanel("radio")}>
                    The radio<span>03</span>
                    <ArrowUpRight />
                  </button>
                  <button onClick={() => openPanel("collection")}>
                    Your collection
                    <span>{String(saved.length).padStart(2, "0")}</span>
                    <Bookmark size={22} strokeWidth={1.4} />
                  </button>
                </div>
                <div className="archive-howto">
                  <span className="eyebrow">A FEW WAYS TO GET LOST</span>
                  <div>
                    <span>Turn the platter</span>
                    <span>
                      DRAG / SCROLL / <kbd>&larr;</kbd> <kbd>&rarr;</kbd>
                    </span>
                  </div>
                  <div>
                    <span>Step inside a record</span>
                    <span>CLICK THE SLEEVE</span>
                  </div>
                  <div>
                    <span>Find your way back</span>
                    <span>
                      <kbd>ESC</kbd>
                    </span>
                  </div>
                </div>
                <div className="contact-note">
                  <span className="eyebrow">KEEP IN GOOD COMPANY</span>
                  <a
                    className="menu-bandcamp"
                    href="https://bandcamp.com/discover"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Follow the independent sound
                    <ArrowUpRight size={18} />
                  </a>
                  <small>
                    An independent archive concept. Made for listening.
                  </small>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <div
        className={`toast ${toast ? "toast-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <Check size={15} />
        {toast}
      </div>
    </div>
  );
}

export default App;
