import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setLoading(false);
      });
      unsubscribe = () => sub.subscription.unsubscribe();

      supabase.auth
        .getSession()
        .then(({ data }) => {
          setSession(data.session);
          setLoading(false);
        })
        .catch((error: unknown) => {
          console.error(error);
          setLoading(false);
        });
    } catch (error) {
      // Missing backend configuration (e.g. env vars not set on the host).
      // Don't crash the whole page — surface it instead.
      console.error(error);
      setConfigError(error instanceof Error ? error.message : String(error));
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, configError };
}
