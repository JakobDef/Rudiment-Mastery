import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  filterRudiments,
  type Difficulty,
  type RudimentCategory,
} from "@/lib/rudiments";

const fieldClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent";

type RudimentLibraryProps = {
  category: RudimentCategory | "all";
  difficulty: Difficulty | "all";
  query: string;
  selectedId: string;
  queueIds: readonly string[];
  onCategory: (category: RudimentCategory | "all") => void;
  onDifficulty: (difficulty: Difficulty | "all") => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onToggleQueue: (id: string) => void;
};

export function RudimentLibrary({
  category,
  difficulty,
  query,
  selectedId,
  queueIds,
  onCategory,
  onDifficulty,
  onQuery,
  onSelect,
  onToggleQueue,
}: RudimentLibraryProps) {
  const rudiments = filterRudiments({ category, difficulty, query });

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel p-3">
      <h2 className="px-1 text-lg font-semibold text-ink">Rudiment library</h2>
      <label className="mt-3 text-sm text-muted">
        Search
        <input
          className={`mt-1 ${fieldClass}`}
          value={query}
          placeholder="Search by name"
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-sm text-muted">
          Category
          <select
            className={`mt-1 ${fieldClass}`}
            value={category}
            onChange={(event) => onCategory(event.target.value as RudimentCategory | "all")}
          >
            <option value="all">All</option>
            {CATEGORY_ORDER.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Difficulty
          <select
            className={`mt-1 ${fieldClass}`}
            value={difficulty}
            onChange={(event) => {
              const value = event.target.value;
              onDifficulty(value === "all" ? "all" : (Number(value) as Difficulty));
            }}
          >
            <option value="all">All</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
            <option value={4}>Level 4</option>
            <option value={5}>Level 5</option>
          </select>
        </label>
      </div>
      <ul className="mt-3 flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
        {rudiments.length === 0 ? (
          <li className="px-1 py-6 text-sm text-muted">No rudiments match.</li>
        ) : (
          rudiments.map((rudiment) => {
            const selected = rudiment.id === selectedId;
            const queued = queueIds.includes(rudiment.id);
            return (
              <li key={rudiment.id}>
                <div
                  className={`rounded-xl border px-3 py-2 ${
                    selected ? "border-accent bg-panel-raised" : "border-line bg-canvas"
                  }`}
                >
                  <button type="button" className="w-full text-left" onClick={() => onSelect(rudiment.id)}>
                    <span className="block font-medium text-ink">{rudiment.name}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {CATEGORY_LABELS[rudiment.category]}, level {rudiment.difficulty}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`mt-2 text-xs font-medium ${queued ? "text-accent" : "text-muted"}`}
                    aria-pressed={queued}
                    onClick={() => onToggleQueue(rudiment.id)}
                  >
                    {queued ? "In workout queue" : "Add to workout queue"}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
