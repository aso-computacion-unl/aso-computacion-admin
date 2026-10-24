import { cn } from "@/lib/utils";

interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  /** The visible label of the group, which is also its accessible name. */
  legend: string;
  name: string;
  value: string;
  options: readonly SegmentedOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Column classes of the cell grid; the default fits up to five options. */
  columnsClassName?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** Radio group drawn as one row of cells: one tap to choose, arrow keys to move, like any radio group. */
export function Segmented({ legend, name, value, options, onChange, className, columnsClassName = "grid-cols-3 sm:grid-cols-5", ...aria }: SegmentedProps) {
  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)} {...aria}>
      <legend className="mb-1.5 p-0 text-sm leading-[1.3] font-[650] text-foreground">{legend}</legend>
      <div className={cn("grid overflow-hidden rounded border border-input bg-muted", columnsClassName)}>
        {options.map((option) => (
          <label key={option.value} className="relative grid min-h-11 cursor-pointer place-items-center">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span
              className={cn(
                "grid size-full place-items-center px-1 text-sm font-semibold text-mist",
                "transition-colors duration-150 ease-out",
                "hover:bg-foreground/6 hover:text-foreground",
                "peer-checked:bg-sky peer-checked:text-primary-foreground",
                "peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-4 peer-focus-visible:outline-foreground",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
