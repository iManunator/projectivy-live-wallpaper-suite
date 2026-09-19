import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type JobSnapshot } from "./lib/api";
import { failedJobToast, idleJob, isActiveJob, jobLabel, jobToast, runJob } from "./lib/jobs";
import { useToasts } from "./toasts";

type JobContextValue = {
  job: JobSnapshot;
  busy: boolean;
  run: (body: Record<string, unknown>) => Promise<JobSnapshot>;
};

const JobContext = createContext<JobContextValue>({
  job: idleJob(),
  busy: false,
  run: async () => idleJob(),
});

export function JobProvider({ children }: { children: ReactNode }) {
  const notify = useToasts();
  const [job, setJob] = useState<JobSnapshot>(idleJob);
  const run = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const final = await runJob(body, setJob);
        const toast = jobToast(final);
        notify(toast.kind, toast.text);
        return final;
      } catch (err) {
        const toast = failedJobToast(err);
        notify(toast.kind, toast.text);
        throw err;
      }
    },
    [notify],
  );

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function tick() {
      try {
        const latest = await api.jobsLatest();
        if (!cancelled) setJob(latest && typeof latest.status === "string" ? latest : idleJob());
        const wait = isActiveJob(latest) ? 350 : 2500;
        timer = window.setTimeout(tick, wait);
      } catch {
        timer = window.setTimeout(tick, 4000);
      }
    }
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => ({ job, busy: isActiveJob(job), run }), [job, run]);
  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJobs(): JobContextValue {
  return useContext(JobContext);
}

export function JobProgress({ job }: { job?: JobSnapshot | null }) {
  const ctx = useJobs();
  const snapshot = job ?? ctx.job;
  if (!snapshot || typeof snapshot.status !== "string" || snapshot.status === "idle" || snapshot.status === "done") return null;
  const active = isActiveJob(snapshot);
  const percent = Math.max(0, Math.min(100, snapshot.percent || 0));
  return (
    <div className={`job-progress ${snapshot.status}`} role="status" aria-live="polite" aria-busy={active}>
      <div className="job-progress-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p>
        <strong>{active ? `${snapshot.done}/${snapshot.total || "?"}` : snapshot.status}</strong>
        {snapshot.current ? ` · ${snapshot.current}` : ""}
        {snapshot.message ? ` — ${snapshot.message}` : jobLabel(snapshot) ? ` — ${jobLabel(snapshot)}` : ""}
      </p>
    </div>
  );
}
