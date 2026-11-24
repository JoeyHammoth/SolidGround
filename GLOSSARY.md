# Glossary

The vocabulary the code, the data and the site must share. Use these terms
exactly; they are the project's domain model.

| Term | Meaning | Avoid |
|---|---|---|
| **Evidence** | A fact about a package, its published code or its upstream repository, with a source, a timestamp and a fingerprint. | data, signal (when you mean evidence) |
| **Verdict** | The status plus confidence, reasons and recommended version produced by the engine for one package. | result, score |
| **Status** | One of `ready`, `prerelease`, `in-progress`, `blocked`, `unmaintained`, `agnostic`, `unknown`. | state, health |
| **Line** | A package release line: a version, its dist-tag, its stability and the `solid-js` range it declares. | channel (only for dist-tags) |
| **Admits** | A declared range accepts at least one tested Solid 2 version. A range that admits Solid 2 is not proof the code works. | supports (ambiguous) |
| **Clean** | The static scan found no imports of APIs that Solid 2 removed. | compatible, works |
| **Verified** | A `ready` verdict backed by a passing build/import smoke test against the tested Solid version, inside its freshness window. | proven, certified |
| **Declared** | Evidence level `D`: based only on metadata such as peer ranges. Weak by design. | verified |
| **Attestation** | A named maintainer's dated claim with a public evidence link, subject to expiry. | endorsement |
| **Candidate** | A package discovered by search but not yet curated or tracked. Never shown with a status. | tracked |
| **Registry** | The human-curated YAML input in `registry/` describing scope, categories, families and attestations. | database |
| **Policy** | The versioned rules in `rules/status-policy.yml` that turn evidence into a verdict. | config |
| **Freshness** | How recently a check ran for a package. Staleness reduces confidence; it never invents a new status. | accuracy |
| **Override** | A visible, expiring, maintainer-approved exception recorded in the registry with evidence. | exception |
| **Disputed** | A maintainer attestation that conflicts with the scan or smoke evidence; shown, never silently accepted. | wrong |
| **Stale** | A check is older than its policy window. A stale `verified` result is shown as `declared`. | broken |
| **Blocking set** | In “check my app”, the dependencies whose status prevents an upgrade. | bad packages |
| **Agnostic** | A package that does not depend on Solid APIs; excluded from readiness percentages. | unsupported |
