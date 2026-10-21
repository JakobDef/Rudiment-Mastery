import type { ButtonHTMLAttributes } from "react";

type ButtonTone = "accent" | "quiet" | "panel";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
};

const tones: Record<ButtonTone, string> = {
  accent: "bg-accent text-canvas-ink hover:opacity-90",
  quiet: "bg-transparent text-ink hover:bg-panel-raised",
  panel: "bg-panel-raised text-ink hover:opacity-90",
};

export function Button({
  tone = "panel",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
