#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
validations = ROOT / "src/lib/validations.ts"
admin = ROOT / "src/actions/admin.ts"

for path in (validations, admin):
    if not path.exists():
        raise SystemExit(f"Missing expected file: {path}")

v = validations.read_text(encoding="utf-8")
a = admin.read_text(encoding="utf-8")

# 1) Quote validation: Task Execution Fee is variable and required.
# Keep agentPayoutNaira accepted temporarily for compatibility with an older form,
# but make it optional because the server now calculates the payout.
v = v.replace(
"""    platformFeeNaira: nairaAmountSchema,
    agentPayoutNaira: nairaAmountSchema,""",
"""    // Business/UI name: Task Execution Fee.
    // The database field remains platform_fee_kobo for backwards compatibility.
    platformFeeNaira: nairaAmountSchema,
    // Legacy form field. The server ignores this value and calculates the
    // agent's 80% share from the Task Execution Fee.
    agentPayoutNaira: nairaAmountSchema.optional().default(0),"""
)

old_refine = """  .refine(
    (data) =>
      data.agentPayoutNaira <=
      data.serviceFeeNaira + data.transportFeeNaira + data.additionalFeeNaira,
    {
      message: 'The agent payout cannot exceed the service, transport and additional charges.',
      path: ['agentPayoutNaira'],
    },
  )"""
new_refine = """  .refine((data) => data.platformFeeNaira > 0, {
    message: 'A task execution fee is required.',
    path: ['platformFeeNaira'],
  })"""
v = v.replace(old_refine, new_refine)

# 2) Quote creation: enforce 80/20 split server-side.
needle = """  const input = parsed.data

  try {"""
replacement = """  const input = parsed.data

  // Task Execution Fee is variable and depends on task difficulty.
  // Enforce the business split server-side so it cannot be altered by the form:
  // 80% -> Go Agent, 20% -> Concierge Go.
  const taskExecutionFeeKobo = input.platformFeeNaira
  const agentPayoutKobo = Math.round(taskExecutionFeeKobo * 0.8)
  const conciergeGoShareKobo = taskExecutionFeeKobo - agentPayoutKobo

  try {"""
if needle not in a:
    raise SystemExit("Could not find createQuoteAction insertion point in src/actions/admin.ts")
a = a.replace(needle, replacement, 1)

a = a.replace(
"""        platform_fee_kobo: input.platformFeeNaira,
        agent_payout_kobo: input.agentPayoutNaira,""",
"""        // Kept as platform_fee_kobo in the DB to avoid a risky schema migration.
        // In the product this is the Task Execution Fee.
        platform_fee_kobo: taskExecutionFeeKobo,
        agent_payout_kobo: agentPayoutKobo,""",
1,
)

# Silence no-unused-vars while keeping the split explicit and available for
# future ledger persistence.
a = a.replace(
"""  const conciergeGoShareKobo = taskExecutionFeeKobo - agentPayoutKobo

  try {""",
"""  const conciergeGoShareKobo = taskExecutionFeeKobo - agentPayoutKobo
  void conciergeGoShareKobo

  try {""",
1,
)

# 3) User-facing wording in TS/TSX files.
# Conservative replacement: labels only, not DB identifiers/API field names.
replacements = {
    "Platform fee": "Task Execution Fee",
    "Platform Fee": "Task Execution Fee",
    "platform fee": "task execution fee",
}

for path in (ROOT / "src").rglob("*"):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    text = path.read_text(encoding="utf-8")
    updated = text
    for old, new in replacements.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding="utf-8")

# 4) Role-specific quote wording.
# Do not show customer-directed "Your quote is ready" wording in admin surfaces.
admin_dir = ROOT / "src/app"
if admin_dir.exists():
    for path in admin_dir.rglob("*.tsx"):
        if "/admin/" not in path.as_posix():
            continue
        text = path.read_text(encoding="utf-8")
        text = text.replace("Your quote is ready.", "Customer quote is ready.")
        text = text.replace(
            "Review the breakdown, then accept or decline it.",
            "The customer can review the breakdown and accept or decline it.",
        )
        path.write_text(text, encoding="utf-8")

validations.write_text(v, encoding="utf-8")
admin.write_text(a, encoding="utf-8")

print("Concierge Go update applied successfully.")
print("- Task Execution Fee terminology applied to user-facing TS/TSX copy")
print("- Variable Task Execution Fee retained")
print("- 80/20 Go Agent / Concierge Go split enforced server-side")
print("- Existing completion/release logic preserved")
print("- Admin customer-directed quote wording corrected where found")
