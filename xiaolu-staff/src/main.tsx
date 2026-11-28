import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import { qe } from '@/lib/trpc';
import { localLink } from '@/lib/localLink';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// Static piece: the mock tRPC router runs in this tab, no server process.
const trpcClient = qe.createClient({
  links: [localLink()],
});

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <qe.Provider client={trpcClient} queryClient={queryClient}>
      <App />
    </qe.Provider>
  </QueryClientProvider>,
);
