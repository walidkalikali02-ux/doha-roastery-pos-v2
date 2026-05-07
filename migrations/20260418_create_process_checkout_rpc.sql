-- Migration: 20260418_create_process_checkout_rpc.sql
-- Purpose: Create atomic checkout function that validates stock, creates transaction,
--          deducts inventory, and updates shift in a single database transaction
-- Depends on: transactions, inventory_items, shifts tables

CREATE OR REPLACE FUNCTION process_checkout(
    p_items JSONB,
    p_payment_method TEXT,
    p_total NUMERIC,
    p_cashier_id UUID,
    p_shift_id UUID,
    p_location_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_unit_price NUMERIC;
    v_current_stock NUMERIC;
    v_available_stock NUMERIC;
    v_insufficient_items TEXT[] := '{}';
BEGIN
    -- Step 1: Validate stock for all items with row-level locking
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        SELECT stock - COALESCE(reserved_stock, 0) - COALESCE(damaged_stock, 0)
        INTO v_available_stock
        FROM inventory_items
        WHERE product_id = v_product_id AND location_id = p_location_id
        FOR UPDATE;

        IF v_available_stock IS NULL OR v_available_stock < v_quantity THEN
            v_insufficient_items := array_append(
                v_insufficient_items,
                COALESCE(
                    (SELECT name FROM product_definitions WHERE id = v_product_id),
                    v_product_id::TEXT
                )
            );
        END IF;
    END LOOP;

    -- If any items have insufficient stock, reject the entire checkout
    IF array_length(v_insufficient_items, 1) > 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'transaction_id', NULL,
            'error', 'Items no longer in stock: ' || array_to_string(v_insufficient_items, ', ')
        );
    END IF;

    -- Step 2: Create the transaction record
    INSERT INTO transactions (
        id, cashier_id, cashier_name, location_id, payment_method,
        total, subtotal, vat_amount, discount_amount, discount_percent,
        discount_type, items, payment_breakdown, received_amount,
        change_amount, is_returned, user_id
    ) VALUES (
        gen_random_uuid(), p_cashier_id,
        COALESCE(
            (SELECT full_name FROM profiles WHERE id = p_cashier_id),
            (SELECT username FROM profiles WHERE id = p_cashier_id)
        ),
        p_location_id, p_payment_method,
        p_total, p_total, 0, 0, 0,
        NULL, p_items, NULL, p_total,
        0, FALSE, p_cashier_id
    ) RETURNING id INTO v_transaction_id;

    -- Step 3: Deduct inventory for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;

        UPDATE inventory_items
        SET stock = stock - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id AND location_id = p_location_id;
    END LOOP;

    -- Step 4: Update shift totals (if shift_id provided)
    IF p_shift_id IS NOT NULL THEN
        UPDATE shifts
        SET total_sales = COALESCE(total_sales, 0) + p_total,
            transaction_count = COALESCE(transaction_count, 0) + 1,
            updated_at = NOW()
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'transaction_id', v_transaction_id,
        'error', NULL
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'transaction_id', NULL,
            'error', SQLERRM
        );
END;
$$;

-- Grant execute to authenticated users
REVOKE EXECUTE ON FUNCTION process_checkout FROM public;
GRANT EXECUTE ON FUNCTION process_checkout TO authenticated;