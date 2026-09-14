---
description: "Payments — the gateway interface, settlement, idempotent fulfilment and the poisha convention"
paths:
  - "lib/payments/**"
  - "app/pay/**"
  - "app/api/payments/**"
---

## Payments

Decisions D32–D35. `lib/payments/` is the kernel money service — every module
raises fees through it, because a module that reimplements payments means the
kernel is wrong (spec §1).

- **The gateway is an interface, and the sandbox is the default.**
  `provider.ts` defines `PaymentProvider`; `sandbox.ts` implements it;
  `registry.ts` picks one from `PAYMENT_PROVIDER`, defaulting to the sandbox
  because the gateway decision is still open and the safe default is the one
  that cannot move money. **Stripe is not an option** — it does not support
  Bangladesh as a merchant country and does not support BDT. SSLCommerz is the
  realistic candidate, and the interface is shaped after it and the e-Challan:
  session → browser redirect → IPN → server-side validation.

- **Only `settlePayment()` may mark a payment paid, and only on a `verify()`
  answer.** The return URL is attacker-controlled and an IPN is an
  unauthenticated POST from the open internet — both are hints that something
  happened, never evidence of what. The IPN body is read for a reference and
  nothing else. The sandbox implements `verify()` against its **own ledger
  table**, `SandboxGatewayTxn`, precisely so the call is a real question to an
  external system rather than a payment row reading its own status. Nothing
  outside `lib/payments/sandbox.ts` may touch that table.

- **Settlement is idempotent and fulfilment happens once.** `settlePayment()`
  claims the row with an `updateMany` guarded on `status: { not: "paid" }`, so
  when the browser return races the IPN both verify but only one sees
  `newlyPaid` — and only that one grants anything. Verified with three
  concurrent settlements producing one purchase.

- **A gateway that collects too little grants nothing.** `amountMatches()` is
  checked on every settlement and the mismatch is written to the row, not just
  logged.

- **Money is integer poisha, never taka floats.** 15% VAT on a whole-taka price
  is fractional for most prices (৳350 → ৳52.50). `splitFee()` is the one place
  the Income/VAT split happens, and `income + vat === total` holds by
  construction — the e-Challan settles one payment into two accounts and they
  have to reconcile. Whether the catalogue price is VAT-inclusive is still
  open, which is why it is one function (D8).

- **The reference is the reconciliation key** (spec §6) — not name, not amount,
  not date, because the payer may pay "from anywhere" and all three collide.
  It is printed on demand notes and will travel by SMS and paper, so **holding
  it is not proof of identity**: `/pay/return/[reference]` requires the session
  and 404s for anyone but the payer.

- **A sandbox payment is labelled everywhere it is visible** — the buy button,
  the hosted page, the receipt, and `Payment.isSandbox` on the row for ever. An
  unlabelled fake payment screen is the one thing here that could genuinely
  mislead someone.

