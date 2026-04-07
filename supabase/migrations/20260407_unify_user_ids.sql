-- Migration: Unify users.id with auth.users.id (UUID)
-- Only migrates the 4 users who have auth_user_id populated.
-- Updates users.id → auth_user_id UUID, and cascades user_id in all child tables.
-- Actual content (thought text, space names, etc.) is NOT modified.

BEGIN;

-- User 1: sassdesu@gmail.com
UPDATE spaces SET user_id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE user_id = '102223749655315240134';
UPDATE stacks SET user_id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE user_id = '102223749655315240134';
UPDATE thoughts SET user_id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE user_id = '102223749655315240134';
UPDATE payments SET user_id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE user_id = '102223749655315240134';
UPDATE feedback SET user_id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE user_id = '102223749655315240134';
UPDATE users SET id = '2bee87f3-3a0b-48f8-bc6b-c8040377538f' WHERE id = '102223749655315240134';

-- User 2: mayoshizaky@gmail.com
UPDATE spaces SET user_id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE user_id = '100085844736539695609';
UPDATE stacks SET user_id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE user_id = '100085844736539695609';
UPDATE thoughts SET user_id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE user_id = '100085844736539695609';
UPDATE payments SET user_id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE user_id = '100085844736539695609';
UPDATE feedback SET user_id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE user_id = '100085844736539695609';
UPDATE users SET id = '6e861bb4-7955-4836-ab2c-0451bc7240f7' WHERE id = '100085844736539695609';

-- User 3: anasbassoumi@gmail.com
UPDATE spaces SET user_id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE user_id = '113068402010739048954';
UPDATE stacks SET user_id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE user_id = '113068402010739048954';
UPDATE thoughts SET user_id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE user_id = '113068402010739048954';
UPDATE payments SET user_id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE user_id = '113068402010739048954';
UPDATE feedback SET user_id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE user_id = '113068402010739048954';
UPDATE users SET id = 'ff0b67cc-7056-40b0-a677-34fb2742a6df' WHERE id = '113068402010739048954';

-- User 4: frarden@gmail.com
UPDATE spaces SET user_id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE user_id = '113933025286918437268';
UPDATE stacks SET user_id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE user_id = '113933025286918437268';
UPDATE thoughts SET user_id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE user_id = '113933025286918437268';
UPDATE payments SET user_id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE user_id = '113933025286918437268';
UPDATE feedback SET user_id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE user_id = '113933025286918437268';
UPDATE users SET id = '211e2a52-f15f-461c-8e09-e11715d17f23' WHERE id = '113933025286918437268';

COMMIT;
