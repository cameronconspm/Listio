# Listio Data Model

> **Maintenance:** When adding migrations, changing RLS, or altering entity relationships, update this document in the same PR.

PostgreSQL schema on Supabase. TypeScript types live in `src/types/models.ts` and should stay aligned with migrations.

**Related docs:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECH_STACK.md](./TECH_STACK.md)

---

## Entity relationships

```
auth.users
    └── profiles (1:1)
            └── households (1:1 private namespace, provisioned on signup)
                    │
                    ├── shopping_lists (default "Groceries")
                    │       └── list_items
                    ├── store_profiles
                    ├── meals ──► meal_ingredients
                    └── recipes ──► recipe_ingredients

            ├── user_preferences (JSON payload)
            ├── user_push_tokens
            └── user_subscription_entitlements (mirror, read-only client)
```

**Scope rule:** List, meals, recipes, and stores are scoped to the user's private data namespace (`household_id` on rows — each user has exactly one private household provisioned on signup). RLS resolves `household_id` via `household_members` for the authenticated user.

---

## Core tables

### `profiles`

1:1 with `auth.users`. Created on signup via trigger.

| Column | Notes |
|--------|-------|
| `id` | PK, FK → `auth.users` |

### `households` / `household_members`

Internal data namespace. Each user gets exactly one private household on signup (`handle_new_user` trigger). There is no multi-user sharing UI — the household is a per-user scope only.

| Table | Purpose |
|-------|---------|
| `households` | Named namespace (default `"Home"`) |
| `household_members` | Links `auth.uid()` to the household for RLS resolution |

### `shopping_lists` (migration `031`)

Parent entity for grocery lists within a household.

| Column | Notes |
|--------|-------|
| `household_id` | FK → households |
| `name` | Default `"Groceries"` |
| `is_default` | One default list per household |
| `sort_order` | Ordering when multiple lists exist |

`list_items.list_id` is **required** (NOT NULL after backfill).

### `list_items`

Grocery rows on a shopping list.

| Column | Notes |
|--------|-------|
| `user_id` | Creator (legacy + attribution) |
| `household_id` | RLS scope |
| `list_id` | FK → `shopping_lists` |
| `name`, `normalized_name` | Display + dedupe key |
| `zone_key` | Store aisle zone (see below) |
| `category` | AI / manual category string |
| `quantity_value`, `quantity_unit` | Optional quantity |
| `is_checked` | Shopping progress |
| `linked_meal_ids` | UUID[] tying item to planned meals |
| `brand_preference`, `substitute_allowed`, `priority`, `is_recurring` | Item metadata (`004`) |

**Zone keys:** `produce`, `bakery_deli`, `meat_seafood`, `dairy_eggs`, `frozen`, `pantry`, `snacks_drinks`, `household_cleaning`, `personal_care`, `other`.

### `store_profiles`

Per-household store layout and location.

| Column | Notes |
|--------|-------|
| `store_type` | `generic`, `kroger_style`, `albertsons_style`, `wholefoods_style`, `costco_style`, `traderjoes_style` |
| `zone_order` | Legacy ordered zone keys |
| `aisle_order` | JSON: built-in zones + custom aisles |
| `latitude`, `longitude`, `location_address`, `place_id` | Store location |
| `is_default` | One default store per household |
| `notes` | Free-text store notes |

### `meals` / `meal_ingredients`

Meal planner rows.

| Column | Notes |
|--------|-------|
| `meal_date`, `meal_slot` | Planner scheduling (`005`) |
| `name`, `notes` | Meal metadata |
| `meal_ingredients` | Linked ingredients with quantities |

### `recipes` / `recipe_ingredients`

Saved recipes.

| Column | Notes |
|--------|-------|
| `recipe_url`, `notes` | Optional (`006`) |
| `is_favorite`, `category`, `last_used_at` | Discovery (`007`) |
| `instructions`, `prep_time`, `cook_time` | Detail fields (`024`) |
| `ingredient_count`, `search_tsv` | Performance + search (`029`) |

---

## Supporting tables

| Table | Purpose | Client access |
|-------|---------|---------------|
| `user_preferences` | Appearance, units, notification toggles, etc. (JSON) | Read/write own |
| `ai_item_cache` | Shared AI categorization cache | Read only; Edge Function writes |
| `user_push_tokens` | Expo push tokens per device | Own rows |
| `user_subscription_entitlements` | RevenueCat mirror for server AI gating | SELECT own only |
| `categorize_openai_usage` | Rate-limit logging for categorize | Service role |
| `parse_recipe_openai_usage` / cache tables | Recipe parse limits + cache | Service role |
| `places_edge_rate_limit` | Per-user Places API buckets | Service role |
| `household_push_log` | Push rate-limit log (legacy; write side inactive) | Service role |

---

## Row Level Security (RLS)

**Pattern:** Authenticated users access rows where their `auth.uid()` maps to the row's `household_id` via `household_members`.

```
household_members.user_id = auth.uid()
  AND household_members.household_id = <table>.household_id
```

Since each user has exactly one private household, this effectively means: "your rows only."

**Exceptions:**

- `profiles` — own row only (`id = auth.uid()`)
- `user_subscription_entitlements` — SELECT own row; no client writes
- `ai_item_cache` — SELECT for authenticated; INSERT/UPDATE via service role only

Migration `016` fixed recursive RLS on household policies.

---

## Triggers & RPCs (notable)

| Name | Role |
|------|------|
| `handle_new_user` | Creates profile + private data namespace (household) on signup |
| `set_updated_at` | Touch `updated_at` on row changes |
| `ensure_user_household` | RPC — provisions or returns the user's household_id |
| `prepare_account_deletion` / deletion cascade | Account removal (`025`, `028`) |
| `search_recipes` | Full-text recipe search RPC (`029`) |

---

## Migration index

Run in numeric order via `supabase db push` or SQL Editor.

| # | File | Summary |
|---|------|---------|
| 001 | `initial_schema` | profiles, store_profiles, list_items, recipes, meals, ai_item_cache |
| 002 | `rls_policies` | Initial RLS |
| 003 | `triggers_seed` | Updated_at, signup triggers |
| 004 | `item_metadata` | brand, priority, recurring on list_items |
| 005 | `meals_planner_schema` | meal_date, meal_slot, planner columns |
| 006 | `recipe_optional` | recipe_url, notes |
| 007 | `recipe_favorites_category` | is_favorite, category, last_used_at |
| 008 | `store_aisle_order_notes` | aisle_order JSON, store notes |
| 009 | `user_preferences_and_ai_cache_rls` | user_preferences; tighten ai_item_cache writes |
| 010 | `households` | households, members tables (internal data namespace) |
| 011 | `household_id_rls` | household_id on entities; per-user RLS |
| 012 | `store_latitude_longitude` | Geo on stores |
| 013 | `store_location_address` | Address label |
| 014 | `ensure_user_household` | Backfill households for existing users |
| 015 | `household_member_limit` | Max 2 members |
| 016 | `household_rls_no_recursion` | Fix RLS recursion |
| 017 | `user_push_tokens` | Push token storage |
| 018 | `household_push_log` | Push rate limiting |
| 019 | `store_place_id` | Google place_id on stores |
| 020 | `text_length_limits` | Max lengths on user text fields |
| 021 | `categorize_openai_usage` | OpenAI usage logging for categorize |
| 022 | `places_edge_rate_limit` | Places Edge rate buckets |
| 023 | `parse_recipe_rate_limit_and_cache` | Recipe parse limits + cache |
| 024 | `recipe_instructions_time` | Instructions and timing fields |
| 025 | `account_deletion_household_cascade` | Deletion cascades |
| 026 | `user_subscription_entitlements` | RevenueCat mirror table |
| 027 | `remove_listio_qa_test_user` | QA cleanup |
| 028 | `prepare_account_deletion_explicit` | Explicit deletion prep RPC |
| 029 | `recipe_ingredient_count_and_search` | ingredient_count, search_tsv, RPC |
| 030 | `place_photo_rate_limit` | Place photo rate limits |
| 031 | `shopping_lists` | shopping_lists; list_items.list_id |

---

## TypeScript alignment

| TS type | Table(s) |
|---------|----------|
| `ListItem` | `list_items` |
| `StoreProfile` | `store_profiles` |
| `Meal`, `MealIngredient` | `meals`, `meal_ingredients` |
| `Recipe`, `RecipeIngredient` | `recipes`, `recipe_ingredients` |
| `ZoneKey`, `StoreType`, `AisleEntry` | Check constraints + JSON shapes |

When adding columns, update both migration and `src/types/models.ts`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial data model documentation (includes shopping_lists) |
