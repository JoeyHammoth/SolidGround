# Security Policy

## Supported versions

Only `main`, the latest published CLI release and the current data schema
receive security fixes. The dataset is versioned; old `schemaVersion` files are
kept readable but are not patched.

## Reporting a vulnerability

Please report privately using GitHub's
[“Report a vulnerability”](https://github.com/JoeyHammoth/SolidGround/security/advisories/new)
button on the Security tab. Do **not** open a public issue.

We aim to acknowledge reports within **3 business days**, triage within 7 days,
and follow coordinated disclosure with a default window of 90 days — sooner
once a fix ships.

## In scope

- Code execution or sandbox escape in the verification pipeline.
- Token or secret exposure, or weaknesses in the workflow supply chain.
- XSS or injection through package-derived data.
- Forged attestations, poisoned data, or tampering with published datasets.
- Vulnerabilities in the CLI or the website.

## Out of scope

- Vulnerabilities in third-party packages that Solid Ground merely lists.
- Disagreements about a package's status — use the
  [correction form](https://github.com/JoeyHammoth/SolidGround/issues/new?template=correct-status.yml).
- Findings that require physical access or social engineering of maintainers.

## How the project protects itself

- The status engine is pure and side-effect free; it never executes package code.
- Static scanning parses files only. Sandboxed smoke tests run in ephemeral
  jobs with `permissions: contents: read`, no secrets, an egress allowlist and
  hard timeouts.
- Package names, versions, URLs and descriptions are treated as hostile input
  and are schema-validated, size-capped and escaped on output.
- Workflows are pinned to commit SHAs, use least-privilege permissions and are
  reviewed before merge.
- Dependabot alerts, secret scanning, push protection, CodeQL and private
  vulnerability reporting are enabled.

## Safe harbour

Good-faith research that follows this policy will not be pursued. Please avoid
privacy violations, service degradation and accessing data that is not yours.

## Credit

We credit reporters in the advisory unless you ask us not to.
