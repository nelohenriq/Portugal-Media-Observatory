# Security Spec - Portugal Media Observatory

## Data Invariants
1. A `SubmittedItem` must have a valid `source_type` and `status`.
2. An `Event` must have a `title` and `status`.
3. A `StageRun` must belong to a valid `Event`.
4. Only authenticated users can submit items (in V1, we assume internal use, but we'll secure it).
5. Only the admin (Hermínio) can publish or delete events.

## Operation Types
- `create`: Create new submissions/events.
- `update`: Update stage results, scores, drafts.
- `list`: View investigations.
- `get`: Detail view.

## Access Control
- V1 is "internal-only", so we will check if `request.auth.uid` is authorized.
- We'll use a `system_config` document to check for authorized editors if needed, or just allow the current user if they are the owner.
- Actually, the user email from runtime is `hhenriques761@gmail.com`. I'll use this as the admin email.

## Dirty Dozen Payloads
(Omitted for brevity in this spec, but will be tested against the rules)
