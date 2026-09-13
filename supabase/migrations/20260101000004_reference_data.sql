-- ============================================================================
-- Concierge Go — 0005 Reference data
--
-- This is real platform configuration, not demo data: cities Concierge Go
-- intends to operate in, and the seven request categories. Only Calabar is
-- live; the rest exist so multi-city launch is a flag flip, not a migration.
-- ============================================================================

insert into public.cities (slug, name, state, is_live, sort_order) values
  ('calabar',       'Calabar',       'Cross River', true,  1),
  ('uyo',           'Uyo',           'Akwa Ibom',   false, 2),
  ('port-harcourt', 'Port Harcourt', 'Rivers',      false, 3),
  ('lagos',         'Lagos',         'Lagos',       false, 4),
  ('abuja',         'Abuja',         'FCT',         false, 5),
  ('enugu',         'Enugu',         'Enugu',       false, 6)
on conflict (slug) do update
  set name = excluded.name,
      state = excluded.state,
      sort_order = excluded.sort_order;

insert into public.task_categories
  (slug, name, tagline, description, icon, examples, requires_proof, typical_service_fee_kobo, sort_order)
values
  (
    'documents-administration',
    'Documents & Administration',
    'Collect, submit, follow up.',
    'Anything that involves standing in a queue, collecting a document, submitting an application or following up with an office on your behalf.',
    'FileText',
    array[
      'Collect a certificate or transcript from a school',
      'Submit an application at a government office',
      'Follow up on a pending file or approval',
      'Pick up and deliver signed documents',
      'Obtain a form and return it completed'
    ],
    true,
    250000,
    1
  ),
  (
    'shopping-sourcing',
    'Shopping & Sourcing',
    'Find it, verify it, buy it.',
    'A Go Agent finds the item, confirms condition and price with you before paying, then delivers it. You approve before money moves.',
    'ShoppingBag',
    array[
      'Buy a specific item from Watt Market',
      'Compare prices across two or three vendors',
      'Buy and verify an item before payment',
      'Source a spare part and confirm it fits',
      'Collect an order already paid for'
    ],
    true,
    200000,
    2
  ),
  (
    'personal-errands',
    'Personal Errands',
    'The things you cannot get to.',
    'Everyday errands handled by someone you can hold accountable, with proof that it actually happened.',
    'Footprints',
    array[
      'Pay a bill in person and send the receipt',
      'Drop something off with a relative',
      'Queue on your behalf',
      'Check on a delivery that never arrived',
      'Collect an item from a repair shop'
    ],
    true,
    150000,
    3
  ),
  (
    'business-tasks',
    'Business Tasks',
    'Operational hands on the ground.',
    'For businesses and people running a business remotely: bank runs, supplier visits, deliveries, and local checks.',
    'Briefcase',
    array[
      'Deliver documents to a client or bank',
      'Visit a supplier and confirm stock',
      'Register or renew a business document',
      'Collect payment evidence from a customer',
      'Represent you at a routine drop-off'
    ],
    true,
    300000,
    4
  ),
  (
    'property-verification',
    'Property Verification',
    'See it before you commit.',
    'A Go Agent visits the address, photographs and films what is actually there, and reports back. Verification of facts on the ground — not legal or title advice.',
    'Home',
    array[
      'Inspect an apartment before you pay a deposit',
      'Confirm a listed property exists at the address',
      'Photograph the current state of a building',
      'Check whether a shop or land is occupied',
      'Verify an address before a business registration'
    ],
    true,
    500000,
    5
  ),
  (
    'events',
    'Events',
    'Local support for something happening.',
    'Practical help around an event: collections, drop-offs, vendor confirmation and day-of errands.',
    'PartyPopper',
    array[
      'Confirm a venue booking in person',
      'Collect items from a vendor before the day',
      'Deliver invitations or programmes',
      'Pick up a cake or supplies on the day',
      'Check setup and send photos'
    ],
    true,
    350000,
    6
  ),
  (
    'other',
    'Other',
    'Describe it and we will tell you.',
    'If it is legal, specific and can be done by a person in the city, describe it. Operations will review and tell you whether Concierge Go can handle it, and what it costs.',
    'Sparkles',
    array[
      'Something that does not fit a category',
      'A multi-step request that needs review',
      'A task you are not sure is possible'
    ],
    true,
    200000,
    7
  )
on conflict (slug) do update
  set name = excluded.name,
      tagline = excluded.tagline,
      description = excluded.description,
      icon = excluded.icon,
      examples = excluded.examples,
      requires_proof = excluded.requires_proof,
      typical_service_fee_kobo = excluded.typical_service_fee_kobo,
      sort_order = excluded.sort_order;
