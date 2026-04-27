-- Truncate overlong text, then enforce max lengths (aligned with app src/constants/textLimits.ts).

-- list_items
UPDATE public.list_items SET name = left(name, 500) WHERE char_length(name) > 500;
UPDATE public.list_items SET normalized_name = left(normalized_name, 500) WHERE char_length(normalized_name) > 500;
UPDATE public.list_items SET category = left(category, 200) WHERE char_length(category) > 200;
UPDATE public.list_items SET notes = left(notes, 2000) WHERE notes IS NOT NULL AND char_length(notes) > 2000;
UPDATE public.list_items SET quantity_unit = left(quantity_unit, 32) WHERE quantity_unit IS NOT NULL AND char_length(quantity_unit) > 32;
UPDATE public.list_items SET brand_preference = left(brand_preference, 200) WHERE brand_preference IS NOT NULL AND char_length(brand_preference) > 200;

ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_name_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_name_len CHECK (char_length(name) <= 500);
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_normalized_name_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_normalized_name_len CHECK (char_length(normalized_name) <= 500);
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_category_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_category_len CHECK (char_length(category) <= 200);
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_notes_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000);
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_quantity_unit_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_quantity_unit_len CHECK (quantity_unit IS NULL OR char_length(quantity_unit) <= 32);
ALTER TABLE public.list_items DROP CONSTRAINT IF EXISTS list_items_brand_preference_len;
ALTER TABLE public.list_items ADD CONSTRAINT list_items_brand_preference_len CHECK (brand_preference IS NULL OR char_length(brand_preference) <= 200);

-- recipes
UPDATE public.recipes SET name = left(name, 500) WHERE char_length(name) > 500;
UPDATE public.recipes SET recipe_url = left(recipe_url, 2048) WHERE recipe_url IS NOT NULL AND char_length(recipe_url) > 2048;
UPDATE public.recipes SET notes = left(notes, 5000) WHERE notes IS NOT NULL AND char_length(notes) > 5000;

ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_name_len;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_name_len CHECK (char_length(name) <= 500);
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_recipe_url_len;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_recipe_url_len CHECK (recipe_url IS NULL OR char_length(recipe_url) <= 2048);
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_notes_len;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_notes_len CHECK (notes IS NULL OR char_length(notes) <= 5000);

-- recipe_ingredients
UPDATE public.recipe_ingredients SET name = left(name, 500) WHERE char_length(name) > 500;
UPDATE public.recipe_ingredients SET quantity_unit = left(quantity_unit, 32) WHERE quantity_unit IS NOT NULL AND char_length(quantity_unit) > 32;
UPDATE public.recipe_ingredients SET notes = left(notes, 2000) WHERE notes IS NOT NULL AND char_length(notes) > 2000;

ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_name_len;
ALTER TABLE public.recipe_ingredients ADD CONSTRAINT recipe_ingredients_name_len CHECK (char_length(name) <= 500);
ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_quantity_unit_len;
ALTER TABLE public.recipe_ingredients ADD CONSTRAINT recipe_ingredients_quantity_unit_len CHECK (quantity_unit IS NULL OR char_length(quantity_unit) <= 32);
ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_notes_len;
ALTER TABLE public.recipe_ingredients ADD CONSTRAINT recipe_ingredients_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000);

-- meals
UPDATE public.meals SET name = left(name, 500) WHERE char_length(name) > 500;
UPDATE public.meals SET custom_slot_name = left(custom_slot_name, 100) WHERE custom_slot_name IS NOT NULL AND char_length(custom_slot_name) > 100;
UPDATE public.meals SET recipe_url = left(recipe_url, 2048) WHERE recipe_url IS NOT NULL AND char_length(recipe_url) > 2048;
UPDATE public.meals SET notes = left(notes, 5000) WHERE notes IS NOT NULL AND char_length(notes) > 5000;

ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_name_len;
ALTER TABLE public.meals ADD CONSTRAINT meals_name_len CHECK (char_length(name) <= 500);
ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_custom_slot_name_len;
ALTER TABLE public.meals ADD CONSTRAINT meals_custom_slot_name_len CHECK (custom_slot_name IS NULL OR char_length(custom_slot_name) <= 100);
ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_recipe_url_len;
ALTER TABLE public.meals ADD CONSTRAINT meals_recipe_url_len CHECK (recipe_url IS NULL OR char_length(recipe_url) <= 2048);
ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_notes_len;
ALTER TABLE public.meals ADD CONSTRAINT meals_notes_len CHECK (notes IS NULL OR char_length(notes) <= 5000);

-- meal_ingredients
UPDATE public.meal_ingredients SET name = left(name, 500) WHERE char_length(name) > 500;
UPDATE public.meal_ingredients SET normalized_name = left(normalized_name, 500) WHERE normalized_name IS NOT NULL AND char_length(normalized_name) > 500;
UPDATE public.meal_ingredients SET quantity_unit = left(quantity_unit, 32) WHERE quantity_unit IS NOT NULL AND char_length(quantity_unit) > 32;
UPDATE public.meal_ingredients SET notes = left(notes, 2000) WHERE notes IS NOT NULL AND char_length(notes) > 2000;
UPDATE public.meal_ingredients SET brand_preference = left(brand_preference, 200) WHERE brand_preference IS NOT NULL AND char_length(brand_preference) > 200;

ALTER TABLE public.meal_ingredients DROP CONSTRAINT IF EXISTS meal_ingredients_name_len;
ALTER TABLE public.meal_ingredients ADD CONSTRAINT meal_ingredients_name_len CHECK (char_length(name) <= 500);
ALTER TABLE public.meal_ingredients DROP CONSTRAINT IF EXISTS meal_ingredients_normalized_name_len;
ALTER TABLE public.meal_ingredients ADD CONSTRAINT meal_ingredients_normalized_name_len CHECK (char_length(normalized_name) <= 500);
ALTER TABLE public.meal_ingredients DROP CONSTRAINT IF EXISTS meal_ingredients_quantity_unit_len;
ALTER TABLE public.meal_ingredients ADD CONSTRAINT meal_ingredients_quantity_unit_len CHECK (quantity_unit IS NULL OR char_length(quantity_unit) <= 32);
ALTER TABLE public.meal_ingredients DROP CONSTRAINT IF EXISTS meal_ingredients_notes_len;
ALTER TABLE public.meal_ingredients ADD CONSTRAINT meal_ingredients_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000);
ALTER TABLE public.meal_ingredients DROP CONSTRAINT IF EXISTS meal_ingredients_brand_preference_len;
ALTER TABLE public.meal_ingredients ADD CONSTRAINT meal_ingredients_brand_preference_len CHECK (brand_preference IS NULL OR char_length(brand_preference) <= 200);

-- store_profiles
UPDATE public.store_profiles SET name = left(name, 200) WHERE char_length(name) > 200;
UPDATE public.store_profiles SET notes = left(notes, 2000) WHERE notes IS NOT NULL AND char_length(notes) > 2000;
UPDATE public.store_profiles SET location_address = left(location_address, 500) WHERE location_address IS NOT NULL AND char_length(location_address) > 500;
UPDATE public.store_profiles SET place_id = left(place_id, 300) WHERE place_id IS NOT NULL AND char_length(place_id) > 300;

ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS store_profiles_name_len;
ALTER TABLE public.store_profiles ADD CONSTRAINT store_profiles_name_len CHECK (char_length(name) <= 200);
ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS store_profiles_notes_len;
ALTER TABLE public.store_profiles ADD CONSTRAINT store_profiles_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000);
ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS store_profiles_location_address_len;
ALTER TABLE public.store_profiles ADD CONSTRAINT store_profiles_location_address_len CHECK (location_address IS NULL OR char_length(location_address) <= 500);
ALTER TABLE public.store_profiles DROP CONSTRAINT IF EXISTS store_profiles_place_id_len;
ALTER TABLE public.store_profiles ADD CONSTRAINT store_profiles_place_id_len CHECK (place_id IS NULL OR char_length(place_id) <= 300);

-- households
UPDATE public.households SET name = left(name, 200) WHERE char_length(name) > 200;
ALTER TABLE public.households DROP CONSTRAINT IF EXISTS households_name_len;
ALTER TABLE public.households ADD CONSTRAINT households_name_len CHECK (char_length(name) <= 200);

-- household_invites
UPDATE public.household_invites SET invitee_email = left(invitee_email, 320) WHERE char_length(invitee_email) > 320;
ALTER TABLE public.household_invites DROP CONSTRAINT IF EXISTS household_invites_email_len;
ALTER TABLE public.household_invites ADD CONSTRAINT household_invites_email_len CHECK (char_length(invitee_email) <= 320);

-- ai_item_cache
UPDATE public.ai_item_cache SET input_text = left(input_text, 500) WHERE char_length(input_text) > 500;
UPDATE public.ai_item_cache SET normalized_name = left(normalized_name, 500) WHERE char_length(normalized_name) > 500;
UPDATE public.ai_item_cache SET category = left(category, 200) WHERE char_length(category) > 200;

ALTER TABLE public.ai_item_cache DROP CONSTRAINT IF EXISTS ai_item_cache_input_text_len;
ALTER TABLE public.ai_item_cache ADD CONSTRAINT ai_item_cache_input_text_len CHECK (char_length(input_text) <= 500);
ALTER TABLE public.ai_item_cache DROP CONSTRAINT IF EXISTS ai_item_cache_normalized_name_len;
ALTER TABLE public.ai_item_cache ADD CONSTRAINT ai_item_cache_normalized_name_len CHECK (char_length(normalized_name) <= 500);
ALTER TABLE public.ai_item_cache DROP CONSTRAINT IF EXISTS ai_item_cache_category_len;
ALTER TABLE public.ai_item_cache ADD CONSTRAINT ai_item_cache_category_len CHECK (char_length(category) <= 200);

-- user_preferences.payload size (UTF-8 octets; app also trims via fitUserPreferencesPayload)
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_payload_octets;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_payload_octets CHECK (octet_length(payload::text) <= 65536);
