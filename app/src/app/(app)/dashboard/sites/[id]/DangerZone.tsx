"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSite } from "../../actions";
import { DeleteSiteButton } from "../../DeleteSiteButton";

export function DangerZone({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSite(siteId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <section className="fade-in-up mt-8 rounded-2xl border border-hairline-soft p-5">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wide text-ink-faint">Danger zone</h2>
      <p className="mb-3 text-sm text-ink-faint">
        Deleting a site removes its pages, version history, and chat history for good. There&rsquo;s no undo.
      </p>
      <DeleteSiteButton onConfirm={handleDelete} disabled={isPending} variant="full" />
    </section>
  );
}
