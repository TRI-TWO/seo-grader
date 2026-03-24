"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClientLite = { id: string; companyName: string | null; canonicalUrl: string };

export default function AdminLocalPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const boot = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!(email === "mgr@tri-two.com" || email === "tri-two@mgr")) {
        router.push("/");
        return;
      }
      setIsAdmin(true);
      const res = await fetch("/api/admin/clients");
      const json = await res.json();
      const list = (json.clients || []).map((c: any) => ({
        id: c.id,
        companyName: c.companyName,
        canonicalUrl: c.canonicalUrl,
      }));
      setClients(list);
      if (list[0]) setClientId(list[0].id);
    };
    void boot();
  }, [router]);

  if (!isAdmin) return null;

  return (
    <main className="min-h-[calc(100vh-200px)] px-6 py-12 text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Local Service OS Input</h1>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <label className="text-sm text-zinc-300">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-2 w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.canonicalUrl}
              </option>
            ))}
          </select>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-left"
            onClick={async () => {
              if (!clientId) return;
              await fetch("/api/admin/local/maps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId,
                  keyword: "ai customer service chatbot",
                  city: "Nashville",
                  rankPosition: 7,
                  asOfDate: new Date().toISOString().slice(0, 10),
                  notes: "Manual snapshot",
                }),
              });
              setMessage("Saved maps snapshot.");
            }}
          >
            <div className="font-semibold">Save Maps Snapshot</div>
            <div className="text-sm text-zinc-400">Manual keyword/city rank entry</div>
          </button>

          <button
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-left"
            onClick={async () => {
              if (!clientId) return;
              await fetch("/api/admin/local/gbp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId,
                  primaryCategory: "Marketing agency",
                  secondaryCategories: ["SEO service", "Business development service"],
                  reviewCount: 42,
                  averageRating: 4.8,
                  reviewVelocity30d: 4,
                  completenessScore: 91,
                  asOfDate: new Date().toISOString().slice(0, 10),
                }),
              });
              setMessage("Saved GBP snapshot.");
            }}
          >
            <div className="font-semibold">Save GBP Snapshot</div>
            <div className="text-sm text-zinc-400">Monthly profile health snapshot</div>
          </button>

          <button
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-left"
            onClick={async () => {
              if (!clientId) return;
              await fetch("/api/admin/local/readiness", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  clientId,
                  asOfDate: new Date().toISOString().slice(0, 10),
                  loomUrl: "https://loom.com/example",
                  top5Actions: [
                    "Resolve indexation gaps",
                    "Improve GBP category fit",
                    "Strengthen hub section structure",
                    "Improve conversion CTA hierarchy",
                    "Increase review velocity",
                  ],
                  recommendedTrack: "CONDITIONAL",
                  inputs: {
                    indexation_crawl: 62,
                    maps_gbp: 55,
                    onpage_hub_structure: 68,
                    conversion_trust: 61,
                    reviews_reputation: 58,
                    performance_mobile: 66,
                    weakHubs: true,
                  },
                }),
              });
              setMessage("Saved readiness assessment.");
            }}
          >
            <div className="font-semibold">Save Readiness Snapshot</div>
            <div className="text-sm text-zinc-400">Option-B weighted readiness output</div>
          </button>
        </section>

        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      </div>
    </main>
  );
}

