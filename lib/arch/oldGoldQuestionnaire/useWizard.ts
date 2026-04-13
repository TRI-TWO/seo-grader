"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeWizardAnswersForCategories } from "./mappers";
import type {
  CustomServiceRow,
  QuestionnaireDraftEnvelope,
  QuestionnaireData,
  WizardServiceAnswers,
} from "./types";
import { emptyDraftEnvelope } from "./defaults";

const SESSION_KEY = (clientId: string) => `oldGoldQuestionnaireDraft:${clientId}`;

function loadSessionEnvelope(clientId: string): QuestionnaireDraftEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(clientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestionnaireDraftEnvelope;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSessionEnvelope(clientId: string, env: QuestionnaireDraftEnvelope) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY(clientId), JSON.stringify(env));
  } catch {
    // ignore quota / private mode
  }
}

export function useOldGoldQuestionnaireWizard(clientId: string) {
  const [envelope, setEnvelope] = useState<QuestionnaireDraftEnvelope>(() => emptyDraftEnvelope());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSessionDebounced = useCallback(
    (env: QuestionnaireDraftEnvelope) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveSessionEnvelope(clientId, env);
      }, 350);
    },
    [clientId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionFirst = loadSessionEnvelope(clientId);
      if (sessionFirst && !cancelled) {
        setEnvelope(sessionFirst);
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(
          `/api/arch/old-gold-questionnaire?clientId=${encodeURIComponent(clientId)}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load saved draft");
        const json = (await res.json()) as { found: boolean; draft?: QuestionnaireDraftEnvelope | null };
        if (cancelled) return;
        if (json.found && json.draft) {
          setEnvelope(json.draft);
        } else {
          setEnvelope(emptyDraftEnvelope());
        }
      } catch {
        if (!cancelled) setEnvelope(emptyDraftEnvelope());
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!loaded) return;
    persistSessionDebounced(envelope);
  }, [envelope, loaded, persistSessionDebounced]);

  const setStepIndex = useCallback((i: number) => {
    setEnvelope((e) => ({ ...e, stepIndex: Math.max(0, Math.min(4, i)) }));
  }, []);

  const patchData = useCallback((patch: Partial<QuestionnaireData>) => {
    setEnvelope((e) => ({
      ...e,
      data: { ...e.data, ...patch },
    }));
  }, []);

  const setCategories = useCallback((categories: string[]) => {
    setEnvelope((e) => {
      const mergedAnswers = mergeWizardAnswersForCategories(categories, e.wizardServiceAnswers);
      return {
        ...e,
        data: { ...e.data, service_categories: categories },
        wizardServiceAnswers: mergedAnswers,
      };
    });
  }, []);

  const setWizardAnswers = useCallback((answers: WizardServiceAnswers) => {
    setEnvelope((e) => ({ ...e, wizardServiceAnswers: answers }));
  }, []);

  const patchWizardAnswer = useCallback((category: string, key: string, value: boolean | null) => {
    setEnvelope((e) => ({
      ...e,
      wizardServiceAnswers: {
        ...e.wizardServiceAnswers,
        [category]: {
          ...(e.wizardServiceAnswers[category] ?? {}),
          [key]: value,
        },
      },
    }));
  }, []);

  const setCustomServices = useCallback((rows: CustomServiceRow[]) => {
    setEnvelope((e) => ({ ...e, customServices: rows }));
  }, []);

  const saveDraftRemote = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/arch/old-gold-questionnaire", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft", clientId, envelope }),
      });
      if (!res.ok) throw new Error("Save draft failed");
      saveSessionEnvelope(clientId, envelope);
      setMessage("Draft saved.");
    } catch {
      setError("Could not save draft. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [clientId, envelope]);

  const submitFinal = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/arch/old-gold-questionnaire", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "submit", clientId, envelope }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        validation?: { stepMessage?: string; fieldErrors?: Record<string, string> };
      };
      if (!res.ok) {
        const sm = json?.validation?.stepMessage;
        if (sm) {
          setError(sm);
          return false;
        }
        const fe = json?.validation?.fieldErrors;
        if (fe && typeof fe === "object") {
          const first = Object.values(fe)[0];
          setError(typeof first === "string" ? first : "Please fix validation errors and try again.");
          return false;
        }
        setError(json?.error || "Submit failed");
        return false;
      }
      setMessage("Setup completed. Thank you.");
      return true;
    } catch {
      setError("Could not complete setup. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [clientId, envelope]);

  return {
    loaded,
    saving,
    message,
    error,
    envelope,
    setEnvelope,
    setStepIndex,
    patchData,
    setCategories,
    setWizardAnswers,
    patchWizardAnswer,
    setCustomServices,
    saveDraftRemote,
    submitFinal,
  };
}
