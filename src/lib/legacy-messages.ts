// Lightweight messaging layer between families and advisors.
// localStorage-backed; threads keyed by sorted (familyEmail, advisorEmail) pair.
// On real backend: a `messages` table with RLS so each side only sees their own threads.

export type Sender = "family" | "advisor";

export type Message = {
  id: string;
  threadId: string;
  sender: Sender;
  senderEmail: string;
  senderName: string;
  body: string;
  createdAt: string;
  readBy: Sender[];
};

const KEY = "legacylink:messages";

export function threadId(familyEmail: string, advisorEmail: string) {
  return `${familyEmail.toLowerCase()}::${advisorEmail.toLowerCase()}`;
}

export function getAllMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(msgs: Message[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(msgs));
}

export function getThread(tid: string): Message[] {
  return getAllMessages()
    .filter((m) => m.threadId === tid)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function sendMessage(input: Omit<Message, "id" | "createdAt" | "readBy">) {
  const msg: Message = {
    ...input,
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    readBy: [input.sender],
  };
  saveAll([...getAllMessages(), msg]);
  return msg;
}

export function markThreadRead(tid: string, side: Sender) {
  const all = getAllMessages();
  let changed = false;
  for (const m of all) {
    if (m.threadId === tid && !m.readBy.includes(side)) {
      m.readBy.push(side);
      changed = true;
    }
  }
  if (changed) saveAll(all);
}

export function unreadCount(tid: string, side: Sender) {
  return getAllMessages().filter((m) => m.threadId === tid && !m.readBy.includes(side)).length;
}

// For advisor side: list distinct family emails who have threads with this advisor.
export function threadsForAdvisor(advisorEmail: string) {
  const ae = advisorEmail.toLowerCase();
  const seen = new Map<
    string,
    { familyEmail: string; familyName: string; lastAt: string; preview: string; unread: number }
  >();
  for (const m of getAllMessages()) {
    const [fam, adv] = m.threadId.split("::");
    if (adv !== ae) continue;
    const prev = seen.get(fam);
    const familyName = m.sender === "family" ? m.senderName : prev?.familyName || fam;
    if (!prev || m.createdAt > prev.lastAt) {
      seen.set(fam, {
        familyEmail: fam,
        familyName,
        lastAt: m.createdAt,
        preview: m.body.slice(0, 80),
        unread: unreadCount(m.threadId, "advisor"),
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
