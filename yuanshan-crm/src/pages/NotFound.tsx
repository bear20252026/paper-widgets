import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { MountainLines } from "@/components/crm/Brand";
import { buttonStyles } from "@/components/ui/button";

export function NotFound() {
  const { m } = useI18n();
  return (
    <div className="relative flex min-h-[calc(100vh-120px)] items-center justify-center overflow-hidden px-6 py-16">
      <MountainLines className="pointer-events-none absolute bottom-0 left-0 h-56 w-full text-ink/[0.08]" />
      <div className="relative max-w-md text-center">
        <div className="num text-[96px] font-light leading-none tracking-tight text-ink">404</div>
        <h1 className="mt-4 font-serif text-[26px] font-semibold text-ink">{m.notFound.title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{m.notFound.body}</p>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{m.notFound.body2}</p>

        <Link to="/" className={buttonStyles({ className: "mt-7" })}>
          {m.notFound.goHome}
        </Link>

        <div className="mt-3">
          <Link
            to="/pipeline"
            className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-ink"
          >
            {m.nav.pipeline}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
