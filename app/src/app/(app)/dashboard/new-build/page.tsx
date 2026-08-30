import { BriefIntakeForm } from "./BriefIntakeForm";

export default function NewBuildPage() {
  return (
    <div className="fade-in-up space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-blue-500">Checkpoint 2 prototype</p>
        <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">Structured brief intake</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Not wired into site creation yet — this is the isolated intake + generation-state UI for review.
          Nothing generated here is saved as a real site.
        </p>
      </div>
      <BriefIntakeForm />
    </div>
  );
}
