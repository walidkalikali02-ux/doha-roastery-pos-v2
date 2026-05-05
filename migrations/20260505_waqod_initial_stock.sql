-- ============================================================
-- Migration: Initial Stock for Waqod Road North Branch
-- Source: woqod stock^.xlsx
-- ============================================================
-- 
-- STEP 1: Create product_definitions for all coffee beans, capsules, and drip pouches
-- STEP 2: Create inventory_items at waqod road North branch with stock from Excel
-- STEP 3: Verify the data
--
-- Location: waqod road North (b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e)
-- Applied: 2026-05-04 (with price NOT NULL fix)
-- ============================================================

-- ============================================================
-- STEP 1: CREATE PRODUCT DEFINITIONS
-- ============================================================

-- ======= COFFEE BEANS (PACKAGED_COFFEE) =======

-- Colombia Finca
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000001-0000-4000-a000-000000000001', 'Colombia Finca 100g', 'Colombia Finca single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000001-0000-4000-a000-000000000002', 'Colombia Finca 250g', 'Colombia Finca single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000001-0000-4000-a000-000000000003', 'Colombia Finca 500g', 'Colombia Finca single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000001-0000-4000-a000-000000000004', 'Colombia Finca 1kg', 'Colombia Finca single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Fall in Love
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000002-0000-4000-a000-000000000001', 'Fall in Love 100g', 'Fall in Love blend coffee - 100g pack', 'BLEND', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000002-0000-4000-a000-000000000002', 'Fall in Love 250g', 'Fall in Love blend coffee - 250g pack', 'BLEND', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000002-0000-4000-a000-000000000003', 'Fall in Love 500g', 'Fall in Love blend coffee - 500g pack', 'BLEND', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000002-0000-4000-a000-000000000004', 'Fall in Love 1kg', 'Fall in Love blend coffee - 1kg pack', 'BLEND', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Brazil Fazenda Villa Boa
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000003-0000-4000-a000-000000000001', 'Brazil Fazenda Villa Boa 100g', 'Brazil Fazenda Villa Boa single origin - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000003-0000-4000-a000-000000000002', 'Brazil Fazenda Villa Boa 250g', 'Brazil Fazenda Villa Boa single origin - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000003-0000-4000-a000-000000000003', 'Brazil Fazenda Villa Boa 500g', 'Brazil Fazenda Villa Boa single origin - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000003-0000-4000-a000-000000000004', 'Brazil Fazenda Villa Boa 1kg', 'Brazil Fazenda Villa Boa single origin - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Dominican Republic
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000004-0000-4000-a000-000000000001', 'Dominican Republic 100g', 'Dominican Republic single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000004-0000-4000-a000-000000000002', 'Dominican Republic 250g', 'Dominican Republic single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000004-0000-4000-a000-000000000003', 'Dominican Republic 500g', 'Dominican Republic single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000004-0000-4000-a000-000000000004', 'Dominican Republic 1kg', 'Dominican Republic single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Honduras Fiallos
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000005-0000-4000-a000-000000000001', 'Honduras Fiallos 100g', 'Honduras Fiallos single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000005-0000-4000-a000-000000000002', 'Honduras Fiallos 250g', 'Honduras Fiallos single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000005-0000-4000-a000-000000000003', 'Honduras Fiallos 500g', 'Honduras Fiallos single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000005-0000-4000-a000-000000000004', 'Honduras Fiallos 1kg', 'Honduras Fiallos single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- QAHWATNA Plain
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000006-0000-4000-a000-000000000001', 'QAHWATNA Plain 100g', 'QAHWATNA Plain blend coffee - 100g pack', 'BLEND', 'PACKAGED_COFFEE', 20, 0, 20, 10, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000006-0000-4000-a000-000000000002', 'QAHWATNA Plain 250g', 'QAHWATNA Plain blend coffee - 250g pack', 'BLEND', 'PACKAGED_COFFEE', 40, 0, 40, 20, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000006-0000-4000-a000-000000000003', 'QAHWATNA Plain 500g', 'QAHWATNA Plain blend coffee - 500g pack', 'BLEND', 'PACKAGED_COFFEE', 70, 0, 70, 35, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000006-0000-4000-a000-000000000004', 'QAHWATNA Plain 1kg', 'QAHWATNA Plain blend coffee - 1kg pack', 'BLEND', 'PACKAGED_COFFEE', 120, 0, 120, 60, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Colombia Decaf
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000007-0000-4000-a000-000000000001', 'Colombia Decaf 100g', 'Colombia Decaf coffee - 100g pack', 'DECAF', 'PACKAGED_COFFEE', 28, 0, 28, 14, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000007-0000-4000-a000-000000000002', 'Colombia Decaf 250g', 'Colombia Decaf coffee - 250g pack', 'DECAF', 'PACKAGED_COFFEE', 55, 0, 55, 28, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000007-0000-4000-a000-000000000003', 'Colombia Decaf 500g', 'Colombia Decaf coffee - 500g pack', 'DECAF', 'PACKAGED_COFFEE', 90, 0, 90, 45, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000007-0000-4000-a000-000000000004', 'Colombia Decaf 1kg', 'Colombia Decaf coffee - 1kg pack', 'DECAF', 'PACKAGED_COFFEE', 160, 0, 160, 80, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Colombia Various
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000008-0000-4000-a000-000000000001', 'Colombia Various 100g', 'Colombia Various origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000008-0000-4000-a000-000000000002', 'Colombia Various 250g', 'Colombia Various origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000008-0000-4000-a000-000000000003', 'Colombia Various 500g', 'Colombia Various origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000008-0000-4000-a000-000000000004', 'Colombia Various 1kg', 'Colombia Various origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Indonesia Various
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000009-0000-4000-a000-000000000001', 'Indonesia Various 100g', 'Indonesia Various origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000009-0000-4000-a000-000000000002', 'Indonesia Various 250g', 'Indonesia Various origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000009-0000-4000-a000-000000000003', 'Indonesia Various 500g', 'Indonesia Various origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000009-0000-4000-a000-000000000004', 'Indonesia Various 1kg', 'Indonesia Various origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Guatemala Various
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000010-0000-4000-a000-000000000001', 'Guatemala Various 100g', 'Guatemala Various origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000010-0000-4000-a000-000000000002', 'Guatemala Various 250g', 'Guatemala Various origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000010-0000-4000-a000-000000000003', 'Guatemala Various 500g', 'Guatemala Various origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000010-0000-4000-a000-000000000004', 'Guatemala Various 1kg', 'Guatemala Various origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- El Salvador
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000011-0000-4000-a000-000000000001', 'El Salvador 100g', 'El Salvador single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000011-0000-4000-a000-000000000002', 'El Salvador 250g', 'El Salvador single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000011-0000-4000-a000-000000000003', 'El Salvador 500g', 'El Salvador single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000011-0000-4000-a000-000000000004', 'El Salvador 1kg', 'El Salvador single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Cascara
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000012-0000-4000-a000-000000000001', 'Cascara 100g', 'Cascara coffee cherry tea - 100g pack', 'SPECIALTY', 'PACKAGED_COFFEE', 20, 0, 20, 8, true, 'ACTIVE', NULL, NULL, 'piece'),
  ('c0000012-0000-4000-a000-000000000002', 'Cascara 250g', 'Cascara coffee cherry tea - 250g pack', 'SPECIALTY', 'PACKAGED_COFFEE', 40, 0, 40, 16, true, 'ACTIVE', NULL, NULL, 'piece'),
  ('c0000012-0000-4000-a000-000000000003', 'Cascara 500g', 'Cascara coffee cherry tea - 500g pack', 'SPECIALTY', 'PACKAGED_COFFEE', 70, 0, 70, 28, true, 'ACTIVE', NULL, NULL, 'piece'),
  ('c0000012-0000-4000-a000-000000000004', 'Cascara 1kg', 'Cascara coffee cherry tea - 1kg pack', 'SPECIALTY', 'PACKAGED_COFFEE', 120, 0, 120, 48, true, 'ACTIVE', NULL, NULL, 'piece');

-- Ethiopia
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000013-0000-4000-a000-000000000001', 'Ethiopia 100g', 'Ethiopia single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 28, 0, 28, 14, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000013-0000-4000-a000-000000000002', 'Ethiopia 250g', 'Ethiopia single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 55, 0, 55, 28, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000013-0000-4000-a000-000000000003', 'Ethiopia 500g', 'Ethiopia single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 90, 0, 90, 45, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000013-0000-4000-a000-000000000004', 'Ethiopia 1kg', 'Ethiopia single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 160, 0, 160, 80, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Yemen
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000014-0000-4000-a000-000000000001', 'Yemen 100g', 'Yemen single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 35, 0, 35, 18, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000014-0000-4000-a000-000000000002', 'Yemen 250g', 'Yemen single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 70, 0, 70, 35, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000014-0000-4000-a000-000000000003', 'Yemen 500g', 'Yemen single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 120, 0, 120, 60, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000014-0000-4000-a000-000000000004', 'Yemen 1kg', 'Yemen single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 210, 0, 210, 105, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- China
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000015-0000-4000-a000-000000000001', 'China 100g', 'China Yunnan single origin coffee - 100g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 25, 0, 25, 12, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000015-0000-4000-a000-000000000002', 'China 250g', 'China Yunnan single origin coffee - 250g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 50, 0, 50, 25, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000015-0000-4000-a000-000000000003', 'China 500g', 'China Yunnan single origin coffee - 500g pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 85, 0, 85, 42, true, 'ACTIVE', NULL, 'Medium', 'piece'),
  ('c0000015-0000-4000-a000-000000000004', 'China 1kg', 'China Yunnan single origin coffee - 1kg pack', 'SINGLE_ORIGIN', 'PACKAGED_COFFEE', 150, 0, 150, 75, true, 'ACTIVE', NULL, 'Medium', 'piece');

-- Turkish Coffee
INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, bean_id, roast_level, unit)
VALUES
  ('c0000016-0000-4000-a000-000000000001', 'Turkish Coffee 100g', 'Turkish Coffee traditional blend - 100g pack', 'TURKISH', 'PACKAGED_COFFEE', 18, 0, 18, 8, true, 'ACTIVE', NULL, 'Dark', 'piece'),
  ('c0000016-0000-4000-a000-000000000002', 'Turkish Coffee 250g', 'Turkish Coffee traditional blend - 250g pack', 'TURKISH', 'PACKAGED_COFFEE', 35, 0, 35, 16, true, 'ACTIVE', NULL, 'Dark', 'piece'),
  ('c0000016-0000-4000-a000-000000000003', 'Turkish Coffee 500g', 'Turkish Coffee traditional blend - 500g pack', 'TURKISH', 'PACKAGED_COFFEE', 60, 0, 60, 28, true, 'ACTIVE', NULL, 'Dark', 'piece'),
  ('c0000016-0000-4000-a000-000000000004', 'Turkish Coffee 1kg', 'Turkish Coffee traditional blend - 1kg pack', 'TURKISH', 'PACKAGED_COFFEE', 105, 0, 105, 50, true, 'ACTIVE', NULL, 'Dark', 'piece');

-- ======= CAPSULES =======

INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, unit)
VALUES
  ('d0000001-0000-4000-a000-000000000001', 'Dark Capsule', 'Dark roast coffee capsule', 'CAPSULES', 'ACCESSORY', 5, 0, 5, 2.5, true, 'ACTIVE', 'piece'),
  ('d0000002-0000-4000-a000-000000000001', 'Colombia Capsule', 'Colombia origin coffee capsule', 'CAPSULES', 'ACCESSORY', 5, 0, 5, 2.5, true, 'ACTIVE', 'piece'),
  ('d0000003-0000-4000-a000-000000000001', 'Brazil Capsule', 'Brazil origin coffee capsule', 'CAPSULES', 'ACCESSORY', 5, 0, 5, 2.5, true, 'ACTIVE', 'piece'),
  ('d0000004-0000-4000-a000-000000000001', 'Ethiopia Capsule', 'Ethiopia origin coffee capsule', 'CAPSULES', 'ACCESSORY', 5, 0, 5, 2.5, true, 'ACTIVE', 'piece'),
  ('d0000005-0000-4000-a000-000000000001', 'El Salvador Capsule', 'El Salvador origin coffee capsule', 'CAPSULES', 'ACCESSORY', 5, 0, 5, 2.5, true, 'ACTIVE', 'piece');

-- ======= DRIP POUCHES =======

INSERT INTO product_definitions (id, name, description, category, type, price, base_price, selling_price, cost_price, is_active, product_status, unit)
VALUES
  ('e0000001-0000-4000-a000-000000000001', 'Brazil Drip Pouch', 'Brazil single origin drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece'),
  ('e0000002-0000-4000-a000-000000000001', 'Fall in Love Drip Pouch', 'Fall in Love blend drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece'),
  ('e0000003-0000-4000-a000-000000000001', 'Indonesia Drip Pouch', 'Indonesia Various origin drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece'),
  ('e0000004-0000-4000-a000-000000000001', 'Honduras Drip Pouch', 'Honduras origin drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece'),
  ('e0000005-0000-4000-a000-000000000001', 'Ethiopia Drip Pouch', 'Ethiopia origin drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece'),
  ('e0000006-0000-4000-a000-000000000001', 'China Drip Pouch', 'China Yunnan origin drip pouch', 'DRIP_POUCH', 'ACCESSORY', 6, 0, 6, 3, true, 'ACTIVE', 'piece');


-- ============================================================
-- STEP 2: CREATE INVENTORY ITEMS AT WAQOD ROAD NORTH
-- Location ID: b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e
-- ============================================================

-- Colombia Finca: 100g=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000001-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Colombia', 'Medium', 12, 5, 100, NOW(), NOW());

-- Fall in Love: 100g=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000002-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Various', 'Medium', 12, 5, 100, NOW(), NOW());

-- Brazil Fazenda Villa Boa: 1kg=3
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000003-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 3, 'PACKAGED_COFFEE', 'Brazil', 'Medium', 75, 5, 100, NOW(), NOW());

-- Dominican Republic: 100g=4
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000004-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 4, 'PACKAGED_COFFEE', 'Dominican Republic', 'Medium', 12, 5, 100, NOW(), NOW());

-- Honduras Fiallos: 1kg=1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000005-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'PACKAGED_COFFEE', 'Honduras', 'Medium', 75, 5, 100, NOW(), NOW());

-- QAHWATNA Plain: 1kg=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000006-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Blend', 'Medium', 60, 5, 100, NOW(), NOW());

-- Colombia Decaf: 100g=1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000007-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'PACKAGED_COFFEE', 'Colombia', 'Medium', 14, 5, 100, NOW(), NOW());

-- Colombia Various: 1kg=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000008-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Colombia', 'Medium', 75, 5, 100, NOW(), NOW());

-- Colombia Various: 100g=4
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000008-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 4, 'PACKAGED_COFFEE', 'Colombia', 'Medium', 12, 5, 100, NOW(), NOW());

-- Indonesia Various: 100g=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000009-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Indonesia', 'Medium', 12, 5, 100, NOW(), NOW());

-- El Salvador: 1kg=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000011-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'El Salvador', 'Medium', 75, 5, 100, NOW(), NOW());

-- El Salvador: 100g=5
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000011-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 5, 'PACKAGED_COFFEE', 'El Salvador', 'Medium', 12, 5, 100, NOW(), NOW());

-- Cascara: 1kg=6
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000012-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 6, 'PACKAGED_COFFEE', 'Various', NULL, 48, 5, 100, NOW(), NOW());

-- Ethiopia: 1kg=1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000013-0000-4000-a000-000000000004', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'PACKAGED_COFFEE', 'Ethiopia', 'Medium', 80, 5, 100, NOW(), NOW());

-- Yemen: 100g=2
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000014-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 2, 'PACKAGED_COFFEE', 'Yemen', 'Medium', 18, 5, 100, NOW(), NOW());

-- China: 100g=1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000015-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'PACKAGED_COFFEE', 'China', 'Medium', 12, 5, 100, NOW(), NOW());

-- Turkish Coffee: 100g=4
INSERT INTO inventory_items (id, product_id, location_id, stock, type, bean_origin, roast_level, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'c0000016-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 4, 'PACKAGED_COFFEE', 'Turkey', 'Dark', 8, 5, 100, NOW(), NOW());


-- ====== CAPSULES WITH STOCK FROM EXCEL ======

-- Dark Capsule: 9
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000001-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 9, 'ACCESSORY', 2.5, 5, 200, NOW(), NOW());

-- Colombia Capsule: 1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000002-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'ACCESSORY', 2.5, 5, 200, NOW(), NOW());

-- Brazil Capsule: 12
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000003-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 12, 'ACCESSORY', 2.5, 5, 200, NOW(), NOW());

-- Ethiopia Capsule: 1
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000004-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 1, 'ACCESSORY', 2.5, 5, 200, NOW(), NOW());

-- El Salvador Capsule: 5
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'd0000005-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 5, 'ACCESSORY', 2.5, 5, 200, NOW(), NOW());


-- ====== DRIP POUCHES (0 stock - just creating entries) ======

-- Brazil Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000001-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());

-- Fall in Love Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000002-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());

-- Indonesia Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000003-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());

-- Honduras Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000004-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());

-- Ethiopia Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000005-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());

-- China Drip Pouch: 0
INSERT INTO inventory_items (id, product_id, location_id, stock, type, cost_per_unit, minimum_stock, maximum_stock, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'e0000006-0000-4000-a000-000000000001', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 0, 'ACCESSORY', 3, 5, 200, NOW(), NOW());


-- ============================================================
-- STEP 3: VERIFY
-- ============================================================

-- Verify products created
SELECT type, COUNT(*) as product_count FROM product_definitions GROUP BY type ORDER BY type;

-- Verify inventory items at waqod road North
SELECT 
  i.type,
  pd.name as product_name,
  pd.category,
  i.bean_origin,
  i.roast_level,
  i.stock,
  i.cost_per_unit
FROM inventory_items i
LEFT JOIN product_definitions pd ON pd.id = i.product_id
WHERE i.location_id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
ORDER BY i.type, pd.name;