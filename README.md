# Change Impact Studio

Change Impact Studio is a static IT change-planning workspace. It models implementation windows and dependencies, calculates transparent likelihood × impact scores, detects conflicts and missing controls, tracks preflight readiness, and exports operational runbooks.

**[Open the live app](https://drummer475-94.github.io/change-impact-studio/)**

## 60-second review

1. Start with the summary strip to see collisions, high-risk changes, and approval readiness.
2. Select the `CHG-1042` / `CHG-1043` collision to inspect the shared VPN dependency and recovery controls.
3. Complete a preflight checklist and download the generated operator runbook.

The implementation is framework-free, has no runtime dependencies, keeps imported plans in the browser, and isolates its tested analysis rules in [`core.js`](core.js).

## Portfolio value

The app demonstrates systems-analysis and IT-operations capabilities through visible product behavior: data modeling, dependency analysis, risk communication, change-control checks, rollback planning, operator handoff, and client-side state management.

## Analysis rules

- Overlapping changes with a shared service or dependency
- High inherent risk from likelihood × impact
- Missing owner, validation, or rollback procedure
- Rollback estimates longer than the booked window
- Friday-evening and weekend protected periods
- Four-part preflight gate for approval, recovery, communications, and monitoring

These defaults are examples, not a claim of ITIL, NIST, or organization-specific compliance. Teams should replace them with their approved policy.

## Professional grounding

The workspace makes the review, security-impact, documentation, implementation, and recovery concerns in [NIST SP 800-53 configuration change control](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) visible as product behavior.

## Run and verify

No build step or third-party dependency is required.

```powershell
npm run check
npm test
python -m http.server 4175
```

Open `http://localhost:4175`.

## GitHub Pages

The included workflow publishes the repository root. Push the project to `main`, then select **GitHub Actions** under **Settings → Pages → Source**.
