import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import type { Consultant } from "@/lib/types";

const ME_KEY = "yuanshan.me";

interface CrmValue {
  consultants: Consultant[];
  consultantMap: Map<number, Consultant>;
  me: Consultant | null;
  setMeId: (id: number) => void;
  openClientId: number | null;
  openClient: (id: number) => void;
  closeClient: () => void;
  newClientOpen: boolean;
  setNewClientOpen: (open: boolean) => void;
}

const CrmContext = createContext<CrmValue | null>(null);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const { data: consultants = [] } = useQuery({
    queryKey: queryKeys.consultants,
    queryFn: api.consultants.list,
    staleTime: 5 * 60_000,
  });

  const [meId, setMeIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(ME_KEY);
    return stored ? Number(stored) : null;
  });
  const [openClientId, setOpenClientId] = useState<number | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);

  const consultantMap = useMemo(
    () => new Map(consultants.map((consultant) => [consultant.id, consultant])),
    [consultants],
  );

  const me = (meId != null ? consultantMap.get(meId) : undefined) ?? consultants[0] ?? null;

  useEffect(() => {
    if (!consultants.length) return;
    if (meId == null || !consultantMap.has(meId)) {
      setMeIdState(consultants[0]!.id);
    }
  }, [consultants, consultantMap, meId]);

  const setMeId = useCallback((id: number) => {
    setMeIdState(id);
    window.localStorage.setItem(ME_KEY, String(id));
  }, []);

  const value = useMemo<CrmValue>(
    () => ({
      consultants,
      consultantMap,
      me,
      setMeId,
      openClientId,
      openClient: (id) => setOpenClientId(id),
      closeClient: () => setOpenClientId(null),
      newClientOpen,
      setNewClientOpen,
    }),
    [consultants, consultantMap, me, setMeId, openClientId, newClientOpen],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmValue {
  const context = useContext(CrmContext);
  if (!context) throw new Error("useCrm must be used inside CrmProvider");
  return context;
}
