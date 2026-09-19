import { seerrBadge } from "./lib/seerr";
import { watchBadge } from "./lib/watch";
import { SeerrBadge } from "./SeerrBadge";
import { WatchBadge } from "./WatchBadge";

export function ChromePills({
  watchState,
  libraryState,
  availability,
  source,
  showWatch = true,
  showSeerr = true,
  className = "",
}: {
  watchState?: string | null;
  libraryState?: string | null;
  availability?: string | null;
  source?: string | null;
  showWatch?: boolean;
  showSeerr?: boolean;
  className?: string;
}) {
  const watch = showWatch ? watchBadge(watchState) : null;
  const seerr = showSeerr ? seerrBadge(libraryState, availability, source) : null;
  if (!watch && !seerr) return null;
  return (
    <div className={`chrome-pills ${className}`.trim()}>
      {watch ? <WatchBadge state={watchState} /> : null}
      {seerr ? <SeerrBadge libraryState={libraryState} availability={availability} source={source} /> : null}
    </div>
  );
}
