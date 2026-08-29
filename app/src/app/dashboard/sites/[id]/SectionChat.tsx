"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sendSectionMessage, type SendMessageState } from "../../actions";
import type { ChatTurn } from "@/lib/ai/generate";

const initialState: SendMessageState = { error: null };

export function SectionChat({
  siteId,
  sectionKey,
  modelLabel,
  disabled,
  initialMessages,
}: {
  siteId: string;
  sectionKey: string;
  modelLabel: string;
  disabled: boolean;
  initialMessages: ChatTurn[];
}) {
  const action = sendSectionMessage.bind(null, siteId, sectionKey);
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
    <div className="mt-4 rounded-lg border border-neutral-800 bg-black">
      <div ref={listRef} className="max-h-96 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="p-2 text-sm text-neutral-600">
            Tell {modelLabel} what this section is for — it&rsquo;ll ask if it needs to know more before
            writing anything.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
                {m.role === "user" ? "You" : modelLabel}
              </span>
              <p
                className={`fade-in-up max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-blue-500 text-white"
                    : "border border-neutral-800 bg-neutral-900 text-neutral-200"
                }`}
              >
                {m.content}
              </p>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex flex-col items-start">
            <span className="mb-1 px-1 font-mono text-[10px] uppercase tracking-wide text-neutral-600">
              {modelLabel}
            </span>
            <p className="fade-in-up inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-500">
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
        className="flex items-center gap-2 border-t border-neutral-800 p-2"
      >
        <input
          name="message"
          required
          placeholder={`Reply to ${modelLabel}…`}
          disabled={disabled || isPending}
          className="field-transition flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || isPending}
          className="press rounded-lg bg-blue-500 px-3 py-2 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
