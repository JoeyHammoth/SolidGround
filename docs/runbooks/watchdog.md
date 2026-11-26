# Watchdog runbook

`watchdog.yml` is the freshness alarm. It reads `meta.json` from the `data`
branch and keeps a single open issue labelled `pipeline-stale` in sync with what
it finds.

## What runs

| Check | Result | Effect |
|---|---|---|
| `meta.json` readable, `lastSuccessfulCollect` inside 72 h | fresh | closes any open `pipeline-stale` issue |
| `lastSuccessfulCollect` older than 72 h | stale | opens the issue, or comments on the existing one |
| `meta.json` missing, unreadable, or without a timestamp | stale | same, with the read failure as the reason |
| The step itself throws | job failure | nothing is opened or closed; fail closed |

The issue body carries the observed age and the recovery steps. It is opened
once and then commented on hourly while the dataset stays stale, so the issue's
own timeline is the record of how long the pipeline was down.

## When

- Hourly at `:43` UTC, staggered after the sentinel (`:07`) and the daily
  collect (`03:17`).
- Manually: `gh workflow run watchdog.yml`.

The design document's table says daily; hourly was chosen because a daily check
can notice a 72-hour threshold only at 96 hours. The job is a single API read
plus a shell comparison.

## Responding to a `pipeline-stale` issue

1. **Read the reason.** It names the timestamp and the age the watchdog saw.
2. **Check whether scheduled workflows still run.**

   ```bash
   gh run list --workflow=sentinel.yml --limit 5
   gh run list --workflow=collect.yml --limit 5
   ```

   No runs at all for days usually means the schedule is disabled, not that it
   is failing.

3. **Check the workflow state.** GitHub disables scheduled workflows after 60
   days without repository activity, and shows `disabled_manually` or
   `disabled_inactivity`:

   ```bash
   gh api repos/JoeyHammoth/SolidGround/actions/workflows \
     --jq '.workflows[] | [.name, .state, .path] | @tsv'
   ```

4. **Re-enable it.**

   ```bash
   gh workflow enable sentinel.yml
   gh workflow enable collect.yml
   ```

   `gh workflow list --all` shows disabled workflows; `gh workflow enable`
   accepts the name, the file name or the numeric id.

5. **Run the pipeline by hand** rather than waiting for the next cron tick:

   ```bash
   gh workflow run sentinel.yml
   ```

   The sentinel dispatches `collect.yml` when it sees a change; with no change,
   dispatch collect directly. The next watchdog run closes the issue once
   `meta.json` is fresh again.

6. **If the failure is a broken collect**, see
   [`collect.md`](./collect.md) for the per-step failures. Fix on a branch, let
   CI run, merge, then dispatch.

## What the watchdog cannot see

The watchdog is itself a scheduled workflow, so the failure modes it reports
also apply to it: if GitHub disables every schedule, or Actions are switched
off, nobody opens the issue. That is why [issue
#11](https://github.com/JoeyHammoth/SolidGround/issues/11) tracks the 60-day
experiment and the optional external dead-man's switch: an outside scheduler
that dispatches `watchdog.yml` (or alerts directly) with a fine-grained token.
If the experiment shows bot heartbeat commits do not reset the timer, the
switch is adopted and recorded as an ADR; until then it is unverified and must
not be described as working.

## A false alarm

If `meta.json` is old but the pipeline is healthy, the publish step is the thing
to look at: `collect.yml` uploads the dataset and `publish` commits it to
`data`. A green `collect` job with a red or skipped `publish` job produces this
issue. Check the `publish` job's log before touching any schedule.
