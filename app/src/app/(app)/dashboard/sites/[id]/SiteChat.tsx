"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendSiteMessage, type SendSiteMessageState } from "./chat-actions";
import type { ChatTurn } from "@/lib/generation/types";

const initialState: SendSiteMessageState = { error: null };

/**
 * The one place to ask for any change on this site — a section's copy, a
 * whole page's tone, anything. The model decides which section(s) to touch;
 * there's no longer a separate chat box per section to hunt for.
 */
export function SiteChat({
  siteId,
  modelLabel,
  disabled,
  initialMessages,
}: {
  siteId: string;
  modelLabel: string;
  disabled: boolean;
  initialMessages: ChatTurn[];
}) {
  const action = sendSiteMessage.bind(null, siteId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [messages, setMessages] = useState<ChatTurn[]>(initialMessages);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Append the assistant's reply during render (not in an effect) per
  // React's "adjust state when a prop changes" pattern — `state` is a
  // fresh object each time the action completes.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success && state.reply) {
      setMessages((prev) => [...prev, { role: "assistant", content: state.reply! }]);
    }
  }

  // The toast and native form reset are real side effects — those belong
  // in an effect.
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) formRef.current?.reset();
  }, [state]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  // Read the message straight from the DOM at submit time (not from
  // controlled state) so the optimistic append can't race React's state
  // batching against the native form submission's own FormData capture.
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const message = String(new FormData(e.currentTarget).get("message") ?? "").trim();
    if (!message) {
      e.preventDefault();
      return;
    }
    setMessages((prev) => [...prev, { role: "user", content: message }]);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-hairline bg-background">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="p-2 text-sm text-ink-faint">
            Ask {modelLabel} to change anything on this site — a section&rsquo;s copy, a whole page&rsquo;s
            tone, or something new entirely. It&rsquo;ll ask if it needs to know more before writing
            anything.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                {m.role === "user" ? "You" : modelLabel}
              </span>
              <p
                className={`fade-in-up max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-accent text-white"
                    : "border border-hairline bg-surface-2 text-white"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex flex-col items-start">
            <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
              {modelLabel}
            </span>
            <p className="fade-in-up inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink-faint">
              <span className="spinner" aria-hidden />
              Thinking…
            </p>
          </div>
        )}
      </div>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-hairline p-3"
      >
        <input
          name="message"
          required
          placeholder={`Ask ${modelLabel} to change anything on this site…`}
          disabled={disabled || isPending}
          className="field-transition flex-1 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || isPending}
          className="press rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
