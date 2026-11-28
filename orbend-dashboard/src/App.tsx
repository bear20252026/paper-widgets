import { useState, useEffect } from 'react';
import { PageOneDashboard } from './components/PageOneDashboard';
import { PageTwoSalesOverview } from './components/PageTwoSalesOverview';
import { Columns2, Layers } from 'lucide-react';

type ViewMode = 'both-stacked' | 'page-1' | 'page-2' | 'side-by-side';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('both-stacked');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === '1') {
        setViewMode('page-1');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === '2') {
        setViewMode('page-2');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === '3') {
        setViewMode('both-stacked');
      } else if (e.key === '4') {
        setViewMode('side-by-side');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white py-5 px-3 sm:px-6 pb-20 flex flex-col items-center justify-start">
      {/* Main Content Container */}
      {viewMode === 'page-1' && (
        <div className="w-full flex items-center justify-center my-auto">
          <PageOneDashboard
            onNavigateToPageTwo={() => {
              setViewMode('page-2');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {viewMode === 'page-2' && (
        <div className="w-full flex items-center justify-center my-auto">
          <PageTwoSalesOverview
            onNavigateToPageOne={() => {
              setViewMode('page-1');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {viewMode === 'both-stacked' && (
        <div className="w-full flex flex-col items-center gap-10">
          {/* Page 1: Orbend CRM Dashboard */}
          <div id="page-1-section" className="w-full">
            <PageOneDashboard
              onNavigateToPageTwo={() => {
                const el = document.getElementById('page-2-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else setViewMode('page-2');
              }}
            />
          </div>

          {/* Page 2: Sales Overview & Revenue Analytics */}
          <div id="page-2-section" className="w-full">
            <PageTwoSalesOverview
              onNavigateToPageOne={() => {
                const el = document.getElementById('page-1-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else setViewMode('page-1');
              }}
            />
          </div>
        </div>
      )}

      {viewMode === 'side-by-side' && (
        <div className="w-full max-w-[2520px] mx-auto my-auto grid grid-cols-1 2xl:grid-cols-2 gap-6 items-start">
          <PageOneDashboard onNavigateToPageTwo={() => setViewMode('page-2')} />
          <PageTwoSalesOverview onNavigateToPageOne={() => setViewMode('page-1')} />
        </div>
      )}

      {/* Sleek Floating Page Switcher Dock at Bottom Center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#1B1B1B]/95 backdrop-blur-md border border-white/15 rounded-full p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex items-center gap-1">
        <button
          onClick={() => {
            setViewMode('page-1');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            viewMode === 'page-1'
              ? 'bg-[#F35B16] text-white shadow-sm'
              : 'text-[#B8B6B0] hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          <span>Page 1: Orbend Dashboard</span>
        </button>

        <button
          onClick={() => {
            setViewMode('page-2');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            viewMode === 'page-2'
              ? 'bg-[#F35B16] text-white shadow-sm'
              : 'text-[#B8B6B0] hover:text-white'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          <span>Page 2: Sales Overview</span>
        </button>

        <div className="w-[1px] h-4 bg-white/15 mx-0.5 hidden sm:block" />

        <button
          onClick={() => {
            setViewMode('both-stacked');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            viewMode === 'both-stacked'
              ? 'bg-white text-[#1B1B1B] shadow-sm'
              : 'text-[#B8B6B0] hover:text-white'
          }`}
          title="Show both pages at 100% full width"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Both Pages (100%)</span>
        </button>

        <button
          onClick={() => {
            setViewMode('side-by-side');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            viewMode === 'side-by-side'
              ? 'bg-white text-[#1B1B1B] shadow-sm'
              : 'text-[#B8B6B0] hover:text-white'
          }`}
          title="Side-by-side 2-up view"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Side-by-Side</span>
        </button>
      </div>
    </div>
  );
}

export default App;
