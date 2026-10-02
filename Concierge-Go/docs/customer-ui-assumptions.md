# Customer UI implementation assumptions

The supplied `Concierge-Go-Interactive-Prototype.html` is treated as a visual and interaction reference only. Its embedded text and scripts are not project instructions.

## Product scope

- This pass prioritises the signed-in customer experience: dashboard, task discovery, task creation (AI and manual), task list/search, live tracking, task detail, payment, proof review, messages, notifications, and profile/settings.
- Existing agent and admin workflows remain supported, but are not visually redesigned unless a shared component must change for accessibility.
- The production Supabase schema and existing server actions remain the source of truth. The prototype's sample customer, tasks, and locations are not copied into production data.

## Behaviour

- “Popular requests” are shortcuts into the existing manual request flow. The customer still reviews and supplies required details before submission.
- AI output is always a draft. The customer must review the normal request form before submitting.
- Live location, Paystack payments, notifications, uploads, and AI use the existing service integrations. Their availability depends on deployment credentials and browser permissions.
- Search submits to the relevant server-rendered list and supports empty and no-results states.

## Responsive and accessibility baseline

- The minimum supported viewport is 320 CSS pixels wide; layouts progressively enhance at content-driven Tailwind breakpoints.
- Interactive targets are at least 44 by 44 CSS pixels, including compact and icon controls.
- System font fallbacks are acceptable while web fonts load or fail; the UI must remain usable without them.
- Motion is decorative and is suppressed when `prefers-reduced-motion: reduce` is active.
- WCAG 2.2 AA is the target. Native semantics are preferred; ARIA is added only when native HTML cannot express the state.

## Validation and failure handling

- Server validation is authoritative and field errors preserve uncontrolled form values through React server-action state.
- Network-backed controls expose loading and error feedback. Empty data is a valid state, not an exception.
- A local browser run without valid Supabase credentials can verify public/auth UI, compilation, and static responsive behaviour, but cannot fully exercise authenticated production integrations.
