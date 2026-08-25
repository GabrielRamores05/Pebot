# Inviting people to a team

**Gives you:** invitations by email, acceptance for both new and existing users,
a pending-invite list, role changes, and removal.

**Use when:** teams exist (`multi-tenancy.md`) and members bring in colleagues.

**Don't use when:** an administrator creates every account by hand — simpler, and
no invitation flow needed.

## Ask the builder

1. **Who can invite people?** Usually owners and admins. Occasionally everyone.
2. **What can a new person do by default?** Their least-privileged role.
3. **Can invitations be sent to someone who doesn't have an account yet?** Almost
   always yes — that's the point — but it decides whether the invitation flow has
   to carry someone through sign-up.
4. **How long should an invitation stay valid?** Seven days is typical. Say that
   an invitation that never expires is a permanent way into their data if the
   email is ever compromised.
5. **What should the invitation email say?** Their words. It's the first thing a
   colleague sees of their product — see `email.md`.
6. **When someone is removed, should they be told?** Business call, and sometimes
   a sensitive one.

Never ask about: token generation, expiry mechanics, email delivery, or how
acceptance is verified.

## Creates

```
supabase/migrations/<ts>_create_invitations.sql
lib/tenancy/invites.ts                    create, accept, revoke, resend
app/invite/[token]/page.tsx               public — the acceptance page
app/(app)/settings/team/                  pending invites, roles, removal
lib/email/templates/team-invite.tsx
tests/acceptance/team-invites.spec.ts
```

## Invariants

- **The token is random, long, single-use, and stored hashed.** Treat it exactly
  like a password: the database holds a hash, the email holds the only copy. A
  readable token in the table means anyone who can see the table can join any team.
- **Acceptance is bound to the invited email address.** Forwarding the email must
  not let a different person join. Verify the signed-in address matches, and say
  so plainly when it doesn't.
- **Invitations expire**, and an expired one gives a clear message with a way to
  ask for a new one — not a dead page.
- **Accepting is idempotent.** Clicking the link twice, or after already joining,
  lands the person in the team rather than erroring or creating a second
  membership.
- **The role is fixed when the invitation is created**, and cannot be changed by
  the person accepting it.
- **Only people permitted by the answer to question 1 may invite**, enforced by an
  RLS policy — not by hiding the button. A hidden button is a suggestion.
- **Re-inviting an existing member does nothing**, quietly. It shouldn't duplicate
  the membership or reset their role.
- **The last owner cannot leave or be removed.** Otherwise a team ends up with
  nobody able to manage billing or invite anyone — a support problem the builder
  cannot fix themselves.
- **Revoking a pending invitation invalidates the link immediately.**
- **Removal takes effect at once** — see `multi-tenancy.md`.
- Pending invitations are visible to the team, with who invited whom and when.
