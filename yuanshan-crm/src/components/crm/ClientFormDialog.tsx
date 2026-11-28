import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { useI18n } from "@/i18n";
import { STAGES, type Client, type Stage } from "@/lib/types";
import { daysFromNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { CompanyLogo } from "./CompanyLogo";

interface FormState {
  company: string;
  industry: string;
  city: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  projectName: string;
  amountWan: string;
  consultantId: string;
  stage: Stage;
  nextFollowUp: string;
  notes: string;
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function emptyState(consultantId: number | null): FormState {
  return {
    company: "",
    industry: "",
    city: "",
    contactName: "",
    contactTitle: "",
    email: "",
    phone: "",
    projectName: "",
    amountWan: "",
    consultantId: consultantId != null ? String(consultantId) : "",
    stage: "lead",
    nextFollowUp: "",
    notes: "",
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onCreated?: (id: number) => void;
}) {
  const { m } = useI18n();
  const { me, consultants } = useCrm();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyState(me?.id ?? null));

  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm({
        company: client.company,
        industry: client.industry,
        city: client.city ?? "",
        contactName: client.contactName,
        contactTitle: client.contactTitle ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        projectName: client.projectName ?? "",
        amountWan: String(client.amount / 10_000),
        consultantId: String(client.consultantId),
        stage: client.stage,
        nextFollowUp: toDateInput(client.nextFollowUpAt),
        notes: client.notes ?? "",
      });
    } else {
      setForm(emptyState(me?.id ?? null));
    }
  }, [open, client, me]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const logoPreview = useMemo(() => form.company || m.form.logoPlaceholder, [form.company, m]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.company.trim() || !form.industry.trim() || !form.contactName.trim()) {
        throw new Error(m.form.requiredMissing);
      }
      const amount = form.amountWan.trim() === "" ? 0 : Number(form.amountWan) * 10_000;
      if (!Number.isFinite(amount) || amount < 0) throw new Error(m.form.invalidAmount);
      const consultantId = Number(form.consultantId);
      if (!consultantId) throw new Error(m.form.ownerMissing);

      const payload = {
        company: form.company.trim(),
        industry: form.industry.trim(),
        city: form.city.trim() || undefined,
        contactName: form.contactName.trim(),
        contactTitle: form.contactTitle.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        projectName: form.projectName.trim() || undefined,
        amount,
        stage: form.stage,
        consultantId,
        nextFollowUpAt: form.nextFollowUp ? new Date(`${form.nextFollowUp}T09:00:00`).toISOString() : null,
        notes: form.notes.trim() || undefined,
      };

      if (client) {
        return api.clients.update(client.id, payload);
      }
      return api.clients.create({
        ...payload,
        logoKey: form.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        expectedCloseAt: daysFromNow(45, 18),
        closedAt: null,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivities });
      queryClient.invalidateQueries({ queryKey: queryKeys.client(saved.id) });
      toast.success(
        client
          ? m.form.updated
          : m.form.added.replace("{company}", saved.company),
      );
      onOpenChange(false);
      onCreated?.(saved.id);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-w-[620px]" labelledBy="client-form-title">
      <div className="flex items-start gap-3">
        <CompanyLogo company={logoPreview} logoKey={form.company} size={44} />
        <div className="min-w-0 flex-1">
          <h2 id="client-form-title" className="font-serif text-[22px] font-semibold text-ink">
            {client ? m.form.editTitle : m.form.newTitle}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {client ? m.form.editHint : m.form.newHint}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="company">{m.form.company}</Label>
          <Input
            id="company"
            value={form.company}
            onChange={(event) => update("company", event.target.value)}
            placeholder={m.form.companyPlaceholder}
          />
        </div>
        <div>
          <Label htmlFor="industry">{m.form.industry}</Label>
          <Input
            id="industry"
            value={form.industry}
            onChange={(event) => update("industry", event.target.value)}
            placeholder={m.form.industryPlaceholder}
          />
        </div>
        <div>
          <Label htmlFor="city">{m.form.city}</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            placeholder={m.form.cityPlaceholder}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="project">{m.form.project}</Label>
          <Input
            id="project"
            value={form.projectName}
            onChange={(event) => update("projectName", event.target.value)}
            placeholder={m.form.projectPlaceholder}
          />
        </div>
        <div>
          <Label htmlFor="contact">{m.form.contact}</Label>
          <Input
            id="contact"
            value={form.contactName}
            onChange={(event) => update("contactName", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contact-title">{m.form.title}</Label>
          <Input
            id="contact-title"
            value={form.contactTitle}
            onChange={(event) => update("contactTitle", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">{m.form.email}</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="phone">{m.form.phone}</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="amount">{m.form.amount}</Label>
          <Input
            id="amount"
            inputMode="decimal"
            value={form.amountWan}
            onChange={(event) => update("amountWan", event.target.value)}
            placeholder={m.form.amountPlaceholder}
          />
        </div>
        <div>
          <Label htmlFor="owner">{m.form.owner}</Label>
          <Select
            id="owner"
            value={form.consultantId}
            onChange={(event) => update("consultantId", event.target.value)}
          >
            <option value="" disabled>
              {m.form.ownerPlaceholder}
            </option>
            {consultants.map((consultant) => (
              <option key={consultant.id} value={consultant.id}>
                {consultant.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="stage">{m.form.stage}</Label>
          <Select
            id="stage"
            value={form.stage}
            onChange={(event) => update("stage", event.target.value as Stage)}
          >
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {m.stages[stage].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="follow-up">{m.form.nextFollowUp}</Label>
          <Input
            id="follow-up"
            type="date"
            value={form.nextFollowUp}
            onChange={(event) => update("nextFollowUp", event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">{m.form.notes}</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder={m.form.notesPlaceholder}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          {m.common.cancel}
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? m.common.saving : client ? m.form.saveChanges : m.form.addClient}
        </Button>
      </div>
    </Modal>
  );
}
