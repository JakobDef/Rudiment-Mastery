import { MAX_BPM, MIN_BPM } from "@/lib/audio-scheduler";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const STEPS = [-5, -1, 1, 5] as const;

type TransportBarProps = {
  bpm: number;
  playing: boolean;
  metronome: boolean;
  loop: boolean;
  locked: boolean;
  onBpmChange: (bpm: number) => void;
  onTogglePlay: () => void;
  onToggleMetronome: () => void;
  onToggleLoop: () => void;
  onTapTempo: () => void;
};

export function TransportBar({
  bpm,
  playing,
  metronome,
  loop,
  locked,
  onBpmChange,
  onTogglePlay,
  onToggleMetronome,
  onToggleLoop,
  onTapTempo,
}: TransportBarProps) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="accent" onClick={onTogglePlay} aria-pressed={playing}>
          {playing ? "Stop" : "Play"}
        </Button>
        <Button tone="quiet" onClick={onTapTempo} disabled={locked}>
          Tap tempo
        </Button>
        <Button tone={metronome ? "accent" : "quiet"} onClick={onToggleMetronome} aria-pressed={metronome}>
          Metronome
        </Button>
        <Button tone={loop ? "accent" : "quiet"} onClick={onToggleLoop} aria-pressed={loop} disabled={locked}>
          Loop
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Slider
          label="BPM"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          disabled={locked}
          onChange={onBpmChange}
        />
        <div className="flex gap-2">
          {STEPS.map((step) => (
            <Button
              key={step}
              tone="panel"
              className="min-w-12 font-mono"
              disabled={locked}
              onClick={() => onBpmChange(bpm + step)}
            >
              {step > 0 ? `+${step}` : step}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
