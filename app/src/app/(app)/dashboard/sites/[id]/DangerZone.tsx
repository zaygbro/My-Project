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
    <section className="fade-in-up mt-8 rounded-xl border border-neutral-900 p-5">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wide text-neutral-600">Danger zone</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Deleting a site removes its pages, version history, and chat history for good. There&rsquo;s no undo.
      </p>
      <DeleteSiteButton onConfirm={handleDelete} disabled={isPending} variant="full" />
    </section>
  );
}
