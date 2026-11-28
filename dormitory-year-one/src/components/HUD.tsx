import { useState } from "react";

type Props = {
  sunset: boolean;
  onToggleTime: () => void;
  onSpell: () => void;
  autoRotate: boolean;
  onToggleRotate: () => void;
};

const plaque =
  "bg-gradient-to-b from-[#5a3d27]/90 to-[#2e1d12]/90 border border-[#c9a46a]/60 shadow-[0_4px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,230,180,0.25)]";

const SPELLS = ["Lumos", "Wingardium Leviosa", "Expelliarmus", "Avis", "Reparo"];

export default function HUD({ sunset, onToggleTime, onSpell, autoRotate, onToggleRotate }: Props) {
  const [messages, setMessages] = useState<{ who: string; text: string }[]>([
    { who: "Bryce", text: "Hey! Did you feed your owl yet?" },
  ]);
  const [draft, setDraft] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [spellToast, setSpellToast] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [newSpells, setNewSpells] = useState(8);

  const last = messages[messages.length - 1];

  function send() {
    if (!draft.trim()) return;
    setMessages((m) => [...m, { who: "You", text: draft.trim() }]);
    setDraft("");
    setTimeout(() => {
      setMessages((m) => [...m, { who: "Hedwina", text: "Hoo! 🦉" }]);
    }, 1200);
  }

  function cast() {
    const s = SPELLS[Math.floor(Math.random() * SPELLS.length)];
    setSpellToast(s);
    setNewSpells((n) => Math.max(0, n - 1));
    onSpell();
    setTimeout(() => setSpellToast(null), 1800);
  }

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-serif text-[#f3e3c3]">
      {/* minimap */}
      <div className="pointer-events-auto absolute left-4 top-4 sm:left-8 sm:top-6">
        <div className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-full border-2 border-[#d8bd8a]/80 bg-[radial-gradient(circle_at_40%_35%,#d9bf98,#a88660_70%,#7a5a3c)] shadow-[0_0_25px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="absolute left-[18%] top-[22%] h-6 w-10 bg-[#8a6040]/50 rotate-12" />
          <div className="absolute right-[18%] top-[30%] h-8 w-6 bg-[#8a6040]/50" />
          <div className="absolute left-[30%] bottom-[18%] h-5 w-12 bg-[#8a6040]/40 -rotate-6" />
          <svg viewBox="0 0 40 40" className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2">
            <defs>
              <radialGradient id="cone" cx="0" cy="0.5" r="1">
                <stop offset="0" stopColor="#fff6d8" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d="M20 20 L40 6 L40 34 Z" fill="url(#cone)" />
            <path d="M14 12 L28 20 L14 28 L18 20 Z" fill="#fffaf0" stroke="#3a2414" strokeWidth="1" />
          </svg>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1e140c]/90 text-[10px]">⇡</div>
        </div>
        {["top-0 left-1/2", "bottom-0 left-1/2", "left-0 top-1/2", "right-0 top-1/2"].map((p) => (
          <span key={p} className={`absolute ${p} -translate-x-1/2 -translate-y-1/2 text-[10px] text-[#f5e2b8]`}>✦</span>
        ))}
      </div>

      {/* top plaque */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3">
        <div className={`${plaque} flex h-11 sm:h-14 w-56 sm:w-96 items-center justify-between rounded-md px-4`}>
          <div className="leading-tight">
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#d8bd8a]">Lion Tower</div>
            <div className="text-sm sm:text-lg">Dormitory · Year One</div>
          </div>
          <button
            onClick={onToggleRotate}
            title="Auto-orbit camera"
            className={`pointer-events-auto flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-[#e8c88a] text-xl transition ${
              autoRotate ? "bg-[#e8c88a] text-[#3a2414]" : "bg-[#2a1a10] text-[#f6d48e] hover:bg-[#3a2414]"
            }`}
          >
            +
          </button>
        </div>
        <button
          onClick={onToggleTime}
          title="Toggle golden hour / sunset"
          className={`${plaque} pointer-events-auto flex h-11 w-11 sm:h-14 sm:w-14 flex-col items-center justify-center rounded-lg hover:brightness-125 transition`}
        >
          <span className="text-[9px] tracking-widest text-[#d8bd8a]">{sunset ? "DUSK" : "DAY"}</span>
          <span className="text-lg sm:text-xl font-bold italic leading-none">01</span>
        </button>
      </div>

      {/* location marker */}
      <div className="absolute right-[6%] top-[44%] hidden sm:flex items-center gap-3 bg-gradient-to-r from-transparent via-black/40 to-transparent px-10 py-2">
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-[#f5e6c6]" strokeWidth={1.6}>
          <path d="M3 21h4v-4h4v-4h4V9h4V5" />
          <path d="M3 21h18" />
          <path d="M8 8l-4-4" />
        </svg>
        <span className="text-2xl tracking-[0.2em] drop-shadow">Castle Corridor</span>
      </div>

      {/* spell toast */}
      {spellToast && (
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2 animate-[fadeUp_1.8s_ease-out_forwards] text-center">
          <div className="text-3xl sm:text-5xl italic text-[#fff1c8] drop-shadow-[0_0_18px_rgba(255,200,100,0.9)]">{spellToast}!</div>
        </div>
      )}

      {/* backpack panel */}
      {bagOpen && (
        <div className={`${plaque} pointer-events-auto absolute bottom-28 right-6 w-64 rounded-lg p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-lg">Backpack</span>
            <button onClick={() => setBagOpen(false)} className="text-[#d8bd8a] hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["🪄", "📜", "🧪", "🪶", "📕", "🍬", "🔮", "🗝️"].map((e) => (
              <div key={e} className="flex aspect-square items-center justify-center rounded border border-[#c9a46a]/40 bg-black/30 text-xl">{e}</div>
            ))}
          </div>
        </div>
      )}

      {/* chat history */}
      {chatOpen && (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 w-[92%] max-w-xl -translate-x-1/2 rounded-md bg-black/55 p-3 text-sm backdrop-blur-sm">
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i}>
                <span className="text-[#7fd6c4]">House Chat </span>
                <span className="text-[#f0d9a8]">{m.who}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* bottom chat bar */}
      <div className="absolute bottom-4 left-1/2 flex w-[94%] max-w-3xl -translate-x-1/2 items-center gap-2">
        <button
          onClick={() => setChatOpen((o) => !o)}
          className={`${plaque} pointer-events-auto relative h-11 rounded-md px-5 text-base hover:brightness-125`}
        >
          Social
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#d8582a] text-[11px] font-sans font-bold text-white">
            {messages.length}
          </span>
        </button>
        <div className="pointer-events-auto flex h-11 flex-1 items-center rounded-md bg-black/45 px-3 backdrop-blur-sm">
          {chatOpen ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Say something to your house…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#c9b48c]/60"
            />
          ) : (
            <button onClick={() => setChatOpen(true)} className="truncate text-left text-sm sm:text-base">
              <span className="text-[#7fd6c4]">House Chat </span>
              <span className="text-[#f0d9a8]">{last.who}: </span>
              <span className="text-[#9ee2f2]">{last.text}</span>
            </button>
          )}
        </div>
        <button
          onClick={() => (chatOpen ? send() : setChatOpen(true))}
          className="pointer-events-auto flex h-11 w-12 items-center justify-center rounded-md bg-black/45 hover:bg-black/60"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#f3e3c3]">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>

      {/* bottom right buttons */}
      <div className="absolute bottom-20 right-4 flex gap-4 sm:bottom-5 sm:right-8 sm:gap-6">
        <button onClick={() => setBagOpen((b) => !b)} className="pointer-events-auto flex flex-col items-center hover:scale-105 transition">
          <span className="text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">🎒</span>
          <span className="text-base sm:text-lg font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">Backpack</span>
        </button>
        <button onClick={cast} className="pointer-events-auto relative flex flex-col items-center hover:scale-105 transition">
          <span className="text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">📖</span>
          {newSpells > 0 && (
            <span className="absolute -top-1 left-0 text-xl font-bold italic text-[#ffe6a8] drop-shadow">{newSpells}</span>
          )}
          <span className="absolute -right-3 -top-3 rounded-full bg-gradient-to-b from-[#f2c66a] to-[#b07a2a] px-1.5 text-xs font-bold text-[#3a2010]">
            New
          </span>
          <span className="text-base sm:text-lg font-bold drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">Spells</span>
        </button>
      </div>

      {/* hint */}
      <div className="absolute left-4 bottom-20 hidden md:block text-xs text-[#e8d4ac]/70">
        Drag to look around · Scroll to zoom · 📅 toggles light
      </div>
    </div>
  );
}
