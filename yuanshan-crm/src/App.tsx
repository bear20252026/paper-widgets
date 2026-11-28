import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { CrmProvider, useCrm } from "@/contexts/CrmContext";
import { I18nProvider, useI18n } from "@/i18n";
import { AppShell } from "@/components/crm/AppShell";
import { ClientDetail } from "@/components/crm/ClientDetail";
import { ClientFormDialog } from "@/components/crm/ClientFormDialog";
import { CloseButton, Sheet } from "@/components/ui/modal";
import { Overview } from "@/pages/Overview";
import { Pipeline } from "@/pages/Pipeline";
import { Clients } from "@/pages/Clients";
import { ClientPage } from "@/pages/ClientPage";
import { NotFound } from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function ClientSheet() {
  const { openClientId, closeClient, newClientOpen, setNewClientOpen, openClient } = useCrm();
  const { m } = useI18n();

  return (
    <>
      <Sheet open={openClientId != null} onOpenChange={(open) => !open && closeClient()}>
        {openClientId != null && (
          <>
            <div className="sticky top-0 z-10 border-b border-border/70 bg-[#FBFAF6]/95 px-5 py-3.5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{m.client.sheetTitle}</div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{m.client.sheetDescription}</p>
                </div>
                <CloseButton onClick={closeClient} label={m.common.close} />
              </div>
            </div>
            <ClientDetail id={openClientId} variant="drawer" />
          </>
        )}
      </Sheet>

      <ClientFormDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onCreated={(id) => openClient(id)}
      />
    </>
  );
}

function AppRoutes() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientPage />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
      <ClientSheet />
    </HashRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <CrmProvider>
          <AppRoutes />
        </CrmProvider>
      </I18nProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "font-sans",
          style: {
            background: "#FBFAF6",
            border: "1px solid #E6E3D9",
            color: "#1E3A32",
          },
        }}
      />
    </QueryClientProvider>
  );
}
