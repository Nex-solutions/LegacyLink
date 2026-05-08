import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { getAdvisor } from "@/lib/legacy-auth";
import { advisorClients } from "@/lib/legacy-data";
import { getThread, markThreadRead, sendMessage, threadId, threadsForAdvisor, unreadCount, type Message } from "@/lib/legacy-messages";

export const Route = createFileRoute("/advisor/messages")({
  head: () => ({ meta: [{ title: "Messages — LegacyLink Advisor" }] }),
  component: AdvisorMessages,
});

type Contact = { email: string; name: string; firm?: string; subtitle: string; status: "active" | "pending" };

function AdvisorMessages() {
  const navigate = useNavigate();
  const [advisor, setAdvisorState] = useState<ReturnType<typeof getAdvisor>>(null);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const a = getAdvisor();
    if (!a) { navigate({ to: "/advisor/login" }); return; }
    setAdvisorState(a);
  }, [navigate]);

  // Build contact list: linked clients (mock) + anyone who has messaged this advisor
  const contacts = useMemo<Contact[]>(() => {
    if (!advisor) return [];
    const list: Contact[] = advisorClients.map(c => ({
      email: c.email,
      name: c.name,
      subtitle: `${c.vaults} vaults · last active ${c.lastActiveDays}d ago`,
      status: "active",
    }));
    for (const t of threadsForAdvisor(advisor.email)) {
      if (!list.some(c => c.email.toLowerCase() === t.familyEmail.toLowerCase())) {
        list.push({ email: t.familyEmail, name: t.familyName, subtitle: "Direct contact", status: "active" });
      }
    }
    return list;
  }, [advisor]);

  useEffect(() => {
    if (!activeEmail && contacts[0]) setActiveEmail(contacts[0].email);
  }, [contacts, activeEmail]);

  const tid = useMemo(() => (advisor && activeEmail ? threadId(activeEmail, advisor.email) : null), [advisor, activeEmail]);

  useEffect(() => {
    if (!tid) return;
    setThread(getThread(tid));
    markThreadRead(tid, "advisor");
  }, [tid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  const active = contacts.find(c => c.email === activeEmail);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !advisor || !active || !tid) return;
    sendMessage({
      threadId: tid,
      sender: "advisor",
      senderEmail: advisor.email,
      senderName: `${advisor.firstName} ${advisor.lastName}`.trim(),
      body: draft.trim(),
    });
    setDraft("");
    setThread(getThread(tid));
  }

  if (!advisor) return null;

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 lg:px-12 pt-6 pb-32 max-w-7xl mx-auto">
        <Blob className="w-[420px] h-[420px] -top-10 -right-20" color="var(--honey)" opacity={0.08} />

        <div className="relative z-10">
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, lineHeight: 1.1 }}>
            Client messages
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
            Stay close to the families you serve. All conversations are private and tied to the access they've granted you.
          </p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 rounded-2xl overflow-hidden" style={{ background: "var(--cream)", border: "1px solid rgba(26,46,26,0.08)" }}>
            <aside className="p-3 lg:border-r" style={{ borderColor: "rgba(26,46,26,0.08)", background: "rgba(26,46,26,0.02)" }}>
              <div className="text-[11px] uppercase tracking-[0.18em] px-3 py-2" style={{ color: "var(--warm-gray)" }}>Families</div>
              {contacts.length === 0 && (
                <div className="text-sm px-3 py-4" style={{ color: "var(--warm-gray)" }}>No clients yet.</div>
              )}
              {contacts.map(c => {
                const u = unreadCount(threadId(c.email, advisor.email), "advisor");
                const isActive = c.email === activeEmail;
                return (
                  <button
                    key={c.email}
                    onClick={() => setActiveEmail(c.email)}
                    className="w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-colors flex items-center gap-3"
                    style={{ background: isActive ? "rgba(26,46,26,0.07)" : "transparent" }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                      style={{ background: "var(--honey)", color: "var(--forest)", fontFamily: "var(--font-serif)" }}>
                      {c.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ color: "var(--forest)", fontWeight: 600 }}>{c.name}</div>
                      <div className="text-[11px] truncate" style={{ color: "var(--warm-gray)" }}>{c.subtitle}</div>
                    </div>
                    {u > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--forest)", color: "var(--cream)", fontWeight: 700 }}>{u}</span>
                    )}
                  </button>
                );
              })}
            </aside>

            <section className="flex flex-col min-h-[60vh] max-h-[75vh]">
              {active ? (
                <>
                  <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(26,46,26,0.08)" }}>
                    <div>
                      <div style={{ color: "var(--forest)", fontWeight: 600 }}>{active.name}</div>
                      <div className="text-[11px]" style={{ color: "var(--warm-gray)" }}>{active.email}</div>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: "rgba(26,46,26,0.06)", color: "var(--forest)" }}>
                      You only see what they grant
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3" style={{ background: "rgba(232,160,32,0.03)" }}>
                    {thread.length === 0 && (
                      <div className="text-center text-sm py-10" style={{ color: "var(--warm-gray)" }}>
                        No messages yet. Send a quick check-in.
                      </div>
                    )}
                    {thread.map(m => {
                      const mine = m.sender === "advisor";
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[78%] rounded-2xl px-4 py-2.5"
                            style={{
                              background: mine ? "var(--forest)" : "var(--cream)",
                              color: mine ? "var(--cream)" : "var(--forest)",
                              border: mine ? "none" : "1px solid rgba(26,46,26,0.1)",
                            }}
                          >
                            <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</div>
                            <div className="text-[10px] mt-1 opacity-70">{format(new Date(m.createdAt), "MMM d · h:mm a")}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>

                  <form onSubmit={handleSend} className="border-t p-3 flex items-end gap-2" style={{ borderColor: "rgba(26,46,26,0.08)" }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                      rows={2}
                      placeholder={`Message ${active.name.split(" ")[0]}…`}
                      className="ll-input flex-1 resize-none"
                    />
                    <button type="submit" className="ll-pill ll-pill-primary text-sm" style={{ padding: "0.7rem 1.2rem" }}>Send</button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--warm-gray)" }}>
                  Select a family to start chatting.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
