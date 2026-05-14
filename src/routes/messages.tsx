import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AppHeader } from "@/components/legacy/Nav";
import { Blob, PageShell } from "@/components/legacy/PageShell";
import { getUser } from "@/lib/legacy-auth";
import { getAdvisorLinks, type AdvisorLink } from "@/lib/legacy-advisors";
import {
  getThread,
  markThreadRead,
  sendMessage,
  threadId,
  unreadCount,
  type Message,
} from "@/lib/legacy-messages";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — LegacyLink" }] }),
  component: FamilyMessages,
});

function FamilyMessages() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [links, setLinks] = useState<AdvisorLink[]>([]);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate({ to: "/login" });
      return;
    }
    setUser(u);
    const ls = getAdvisorLinks();
    setLinks(ls);
    if (ls[0]) setActiveEmail(ls[0].email);
  }, [navigate]);

  const tid = useMemo(
    () => (user && activeEmail ? threadId(user.email, activeEmail) : null),
    [user, activeEmail],
  );

  useEffect(() => {
    if (!tid) return;
    setThread(getThread(tid));
    markThreadRead(tid, "family");
  }, [tid]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const active = links.find((l) => l.email === activeEmail);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !user || !active || !tid) return;
    sendMessage({
      threadId: tid,
      sender: "family",
      senderEmail: user.email,
      senderName: user.name,
      body: draft.trim(),
    });
    setDraft("");
    setThread(getThread(tid));
    if (active.status === "pending") {
      toast.success("Saved. They'll see it as soon as they accept your invite.");
    }
  }

  if (!user) return null;

  return (
    <PageShell>
      <AppHeader />
      <div className="relative px-6 lg:px-12 pt-6 pb-32 max-w-7xl mx-auto">
        <Blob
          className="w-[420px] h-[420px] -top-10 -right-20"
          color="var(--sage)"
          opacity={0.08}
        />

        <div className="relative z-10">
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px,4vw,42px)",
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            Messages
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
            A private channel between you and your advisor. Encrypted in transit, tied to your vault
            context.
          </p>

          {links.length === 0 ? (
            <div
              className="mt-10 rounded-2xl p-8 text-center"
              style={{ background: "rgba(26,46,26,0.04)" }}
            >
              <p
                style={{
                  color: "var(--forest)",
                  fontFamily: "var(--font-serif)",
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                No advisor linked yet.
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--warm-gray)" }}>
                Add an advisor from your dashboard to start a conversation.
              </p>
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="mt-5 ll-pill ll-pill-primary text-sm"
                style={{ padding: "0.6rem 1.2rem" }}
              >
                Go to dashboard
              </button>
            </div>
          ) : (
            <div
              className="mt-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 rounded-2xl overflow-hidden"
              style={{ background: "var(--cream)", border: "1px solid rgba(26,46,26,0.08)" }}
            >
              {/* Sidebar */}
              <aside
                className="p-3 lg:border-r"
                style={{ borderColor: "rgba(26,46,26,0.08)", background: "rgba(26,46,26,0.02)" }}
              >
                <div
                  className="text-[11px] uppercase tracking-[0.18em] px-3 py-2"
                  style={{ color: "var(--warm-gray)" }}
                >
                  Your advisors
                </div>
                {links.map((l) => {
                  const u = user ? unreadCount(threadId(user.email, l.email), "family") : 0;
                  const isActive = l.email === activeEmail;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setActiveEmail(l.email)}
                      className="w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-colors flex items-center gap-3"
                      style={{ background: isActive ? "rgba(26,46,26,0.07)" : "transparent" }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{
                          background: "var(--forest)",
                          color: "var(--cream)",
                          fontFamily: "var(--font-serif)",
                        }}
                      >
                        {l.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm truncate"
                          style={{ color: "var(--forest)", fontWeight: 600 }}
                        >
                          {l.name}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: "var(--warm-gray)" }}>
                          {l.status === "connected" ? l.firm || "Linked" : "Pending invite"}
                        </div>
                      </div>
                      {u > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: "var(--honey)",
                            color: "var(--forest)",
                            fontWeight: 700,
                          }}
                        >
                          {u}
                        </span>
                      )}
                    </button>
                  );
                })}
              </aside>

              {/* Thread */}
              <section className="flex flex-col min-h-[60vh] max-h-[75vh]">
                {active ? (
                  <>
                    <div
                      className="px-5 py-4 border-b flex items-center justify-between"
                      style={{ borderColor: "rgba(26,46,26,0.08)" }}
                    >
                      <div>
                        <div style={{ color: "var(--forest)", fontWeight: 600 }}>{active.name}</div>
                        <div className="text-[11px]" style={{ color: "var(--warm-gray)" }}>
                          {active.status === "connected"
                            ? "● Linked · read-only access to vaults you grant"
                            : "○ Pending invite"}
                        </div>
                      </div>
                      <span
                        className="text-[11px] px-2 py-1 rounded-full"
                        style={{ background: "rgba(26,46,26,0.06)", color: "var(--forest)" }}
                      >
                        End-to-end private
                      </span>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
                      style={{ background: "rgba(232,160,32,0.03)" }}
                    >
                      {thread.length === 0 && (
                        <div
                          className="text-center text-sm py-10"
                          style={{ color: "var(--warm-gray)" }}
                        >
                          Say hello. Share an update, ask a question, or send context for a vault.
                        </div>
                      )}
                      {thread.map((m) => {
                        const mine = m.sender === "family";
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className="max-w-[78%] rounded-2xl px-4 py-2.5"
                              style={{
                                background: mine ? "var(--forest)" : "var(--cream)",
                                color: mine ? "var(--cream)" : "var(--forest)",
                                border: mine ? "none" : "1px solid rgba(26,46,26,0.1)",
                              }}
                            >
                              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                {m.body}
                              </div>
                              <div className="text-[10px] mt-1 opacity-70">
                                {format(new Date(m.createdAt), "MMM d · h:mm a")}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={endRef} />
                    </div>

                    <form
                      onSubmit={handleSend}
                      className="border-t p-3 flex items-end gap-2"
                      style={{ borderColor: "rgba(26,46,26,0.08)" }}
                    >
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend(e as any);
                          }
                        }}
                        rows={2}
                        placeholder={`Message ${active.name.split(" ")[0]}…`}
                        className="ll-input flex-1 resize-none"
                      />
                      <button
                        type="submit"
                        className="ll-pill ll-pill-primary text-sm"
                        style={{ padding: "0.7rem 1.2rem" }}
                      >
                        Send
                      </button>
                    </form>
                  </>
                ) : (
                  <div
                    className="flex-1 flex items-center justify-center text-sm"
                    style={{ color: "var(--warm-gray)" }}
                  >
                    Select an advisor to start chatting.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
