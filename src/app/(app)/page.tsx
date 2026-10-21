import { PracticeMetronome } from "@/components/practice-metronome";
import { PracticeTimer } from "@/components/practice-timer";

export default function MetronomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <PracticeTimer />
      <PracticeMetronome />
    </div>
  );
}
