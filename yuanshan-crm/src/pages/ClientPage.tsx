import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n";
import { ClientDetail } from "@/components/crm/ClientDetail";

export function ClientPage() {
  const { id } = useParams();
  const { m } = useI18n();
  const clientId = Number(id);

  if (!Number.isFinite(clientId) || clientId <= 0) {
    return <div className="p-10 text-center text-sm text-muted-foreground">{m.client.invalidId}</div>;
  }

  return (
    <div className="pt-5 lg:pt-7">
      <div className="px-5 pb-4 lg:px-10">
        <Link
          to="/clients"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          {m.client.allClients}
        </Link>
      </div>
      <ClientDetail id={clientId} variant="page" />
    </div>
  );
}
