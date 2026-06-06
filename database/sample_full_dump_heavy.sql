-- Energy Share HEAVY sample data dump (PostgreSQL)
-- Use after Django migrations.
-- This variant provides broader scenarios for QA:
-- - More users
-- - Loan states: APPROVED / REJECTED / DISBURSED / COMPLETED / DEFAULTED
-- - Multi-token history
-- - Share history (completed + pending + cancelled)

BEGIN;

CREATE SCHEMA IF NOT EXISTS custom;
SET search_path TO custom, public;

-- ---------------------------------------------------------------------------
-- Cleanup (children -> parents)
-- ---------------------------------------------------------------------------
DELETE FROM ussd_ussdsession;
DELETE FROM share_share;
DELETE FROM share_sharetransaction;
DELETE FROM transactions_unittransaction;
DELETE FROM transactions_transactionlog;
DELETE FROM transactions_transaction;
DELETE FROM wallet_metertransaction;
DELETE FROM wallet_meterbalance;
DELETE FROM wallet_transaction;
DELETE FROM wallet_wallet;
DELETE FROM meter_metertoken;
DELETE FROM meter_meter;
DELETE FROM loan_loanrepayment;
DELETE FROM loan_loandisbursement;
DELETE FROM loan_loanapplication;
DELETE FROM loan_usercreditsignal;
DELETE FROM loan_tariffblock;
DELETE FROM loan_electricitytariff;
DELETE FROM loan_loantier;
DELETE FROM accounts_walletlog;
DELETE FROM accounts_wallet;
DELETE FROM accounts_useraccountdetails;
DELETE FROM accounts_profile;
DELETE FROM accounts_user_groups;
DELETE FROM accounts_user_user_permissions;
DELETE FROM accounts_user;

-- ---------------------------------------------------------------------------
-- Users (password hash corresponds to Pass1234!)
-- ---------------------------------------------------------------------------
INSERT INTO accounts_user (
    id, password, last_login, is_superuser, first_name, last_name, is_staff, is_active,
    date_joined, create_date, modify_date, email, phone_number, account_is_active,
    user_role, gender, monthly_unit_balance, last_purchase_date,
    monthly_expenditure, purchase_frequency, payment_consistency, disconnection_history,
    meter_sharing, monthly_income, income_stability, consumption_level
) VALUES
(1, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), TRUE,  'System', 'Admin',  TRUE, TRUE, NOW(), NOW(), NOW(), 'admin@powercred.local', '+256700000001', TRUE, 'ADMIN',  'MALE',   0.0, CURRENT_DATE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), FALSE, 'Jane',   'Client', FALSE, TRUE, NOW(), NOW(), NOW(), 'jane@powercred.local',  '+256701234567', TRUE, 'CLIENT', 'FEMALE', 320.0, CURRENT_DATE, '50,000–100,000 UGX', 'Weekly',    'Often on time',    '1–2 disconnections', 'Shared with 1 household', '200,000–499,999 UGX', 'Regular but variable', 'Low (50–99 kWh)'),
(3, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), FALSE, 'John',   'Client', FALSE, TRUE, NOW(), NOW(), NOW(), 'john@powercred.local',  '+256701111111', TRUE, 'CLIENT', 'MALE',   140.0, CURRENT_DATE, '100,001–200,000 UGX','Bi-weekly', 'Sometimes late',   '3–4 disconnections', 'No sharing',               '100,000–199,999 UGX', 'Seasonal income',      'Moderate (100–200 kWh)'),
(4, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), FALSE, 'Mary',   'Client', FALSE, TRUE, NOW(), NOW(), NOW(), 'mary@powercred.local',  '+256702222222', TRUE, 'CLIENT', 'FEMALE',  60.0, CURRENT_DATE, '<50,000 UGX',         'Monthly',   'Mostly late',      '>4 disconnections',   'No sharing',               '<100,000 UGX',        'Unstable income',      'Very low (<50 kWh)'),
(5, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), FALSE, 'Peter',  'Client', FALSE, TRUE, NOW(), NOW(), NOW(), 'peter@powercred.local', '+256703333333', TRUE, 'CLIENT', 'MALE',   480.0, CURRENT_DATE, '>300,000 UGX',        'Daily',     'Always on time',   'No disconnections',   'Commercial sharing',        '>1,000,000 UGX',      'Fixed and stable',     'High (>200 kWh)'),
(6, 'pbkdf2_sha256$870000$M2wWxQxj8J74sEiTn8XHqC$RN/N5hm7Hf1jI1j5uTmz8iN7vJQGW4j1Wc7hJdRtnHA=', NOW(), FALSE, 'Amina',  'Client', FALSE, TRUE, NOW(), NOW(), NOW(), 'amina@powercred.local', '+256704444444', TRUE, 'CLIENT', 'FEMALE', 210.0, CURRENT_DATE, '200,001–300,000 UGX','Weekly',    'Often on time',    'No disconnections',   'Shared with 2+ households', '500,000–999,999 UGX', 'Regular but variable', 'Moderate (100–200 kWh)');

INSERT INTO accounts_profile (id, create_date, modify_date, user_id, email_verified, id_image) VALUES
(1, NOW(), NOW(), 1, TRUE, NULL),
(2, NOW(), NOW(), 2, TRUE, NULL),
(3, NOW(), NOW(), 3, TRUE, NULL),
(4, NOW(), NOW(), 4, TRUE, NULL),
(5, NOW(), NOW(), 5, TRUE, NULL),
(6, NOW(), NOW(), 6, TRUE, NULL);

INSERT INTO accounts_useraccountdetails (id, create_date, modify_date, user_id, account_number, address, energy_preference, payment_method) VALUES
(1, NOW(), NOW(), 1, 'EN-90000001', 'Kampala HQ',        'HYDRO', 'BANK_TRANSFER'),
(2, NOW(), NOW(), 2, 'EN-90000002', 'Nakawa',            'SOLAR', 'MOBILE_MONEY'),
(3, NOW(), NOW(), 3, 'EN-90000003', 'Mukono',            'HYDRO', 'MOBILE_MONEY'),
(4, NOW(), NOW(), 4, 'EN-90000004', 'Jinja',             'OTHER', 'MOBILE_MONEY'),
(5, NOW(), NOW(), 5, 'EN-90000005', 'Mbarara',           'HYDRO', 'BANK_TRANSFER'),
(6, NOW(), NOW(), 6, 'EN-90000006', 'Entebbe',           'SOLAR', 'MOBILE_MONEY');

INSERT INTO accounts_wallet (id, create_date, modify_date, wallet_id, user_id, currency, balance) VALUES
(1, NOW(), NOW(), 'ADMNWAL001', 1, 'USD', 0.00),
(2, NOW(), NOW(), 'JANEWAL002', 2, 'USD', 90000.00),
(3, NOW(), NOW(), 'JOHNWAL003', 3, 'USD', 25000.00),
(4, NOW(), NOW(), 'MARYWAL004', 4, 'USD', 12000.00),
(5, NOW(), NOW(), 'PETEWAL005', 5, 'USD', 150000.00),
(6, NOW(), NOW(), 'AMINWAL006', 6, 'USD', 70000.00);

-- ---------------------------------------------------------------------------
-- Loan config + tariff config
-- ---------------------------------------------------------------------------
INSERT INTO loan_loantier (id, name, display_name, min_score, max_score, max_amount, interest_rate, is_active, created_at, updated_at) VALUES
(1, 'BRONZE',   'Bronze',   75, 79,  50000.00, 12.00, TRUE, NOW(), NOW()),
(2, 'SILVER',   'Silver',   80, 84, 100000.00, 11.00, TRUE, NOW(), NOW()),
(3, 'GOLD',     'Gold',     85, 89, 150000.00, 10.00, TRUE, NOW(), NOW()),
(4, 'PLATINUM', 'Platinum', 90, 100,200000.00,  9.00, TRUE, NOW(), NOW());

INSERT INTO loan_electricitytariff (id, tariff_code, tariff_name, tariff_type, voltage_level, voltage_value, service_charge, is_active, effective_date) VALUES
(1, 'CODE10.1', 'Domestic Lifeline', 'DOMESTIC', 'LOW', '240V', 0.00, TRUE, NOW()),
(2, 'COMM20.2', 'Commercial Peak',   'COMMERCIAL', 'MEDIUM', '415V', 5000.00, TRUE, NOW());

INSERT INTO loan_tariffblock (id, tariff_id, block_name, min_units, max_units, rate_per_unit, block_order) VALUES
(1, 1, 'Lifeline',  0,   50, 450.00, 1),
(2, 1, 'Standard',  51, 200, 600.00, 2),
(3, 1, 'High Use',  201, NULL, 800.00, 3),
(4, 2, 'Commercial Base', 0, 100, 700.00, 1),
(5, 2, 'Commercial High', 101, NULL, 950.00, 2);

INSERT INTO loan_usercreditsignal (id, created_at, updated_at, user_id, payment_history, energy_consumption, financial_capacity, source) VALUES
(1, NOW(), NOW(), 2, 'GOOD', 'MODERATE', 'AVERAGE', 'HEAVY_SEED'),
(2, NOW(), NOW(), 3, 'FAIR', 'STABLE',   'WEAK',    'HEAVY_SEED'),
(3, NOW(), NOW(), 4, 'POOR', 'ERRATIC',  'WEAK',    'HEAVY_SEED'),
(4, NOW(), NOW(), 5, 'GOOD', 'STABLE',   'STRONG',  'HEAVY_SEED'),
(5, NOW(), NOW(), 6, 'FAIR', 'MODERATE', 'AVERAGE', 'HEAVY_SEED');

-- ---------------------------------------------------------------------------
-- Meter + unit wallets + meter balances
-- ---------------------------------------------------------------------------
INSERT INTO meter_meter (id, create_date, modify_date, meter_no, static_ip, user_id, units) VALUES
(1, NOW(), NOW(), '1234567890', '192.168.10.10', 2, 0.00),
(2, NOW(), NOW(), '1234567891', '192.168.10.11', 3, 0.00),
(3, NOW(), NOW(), '1234567892', '192.168.10.12', 4, 0.00),
(4, NOW(), NOW(), '1234567893', '192.168.10.13', 5, 0.00),
(5, NOW(), NOW(), '1234567894', '192.168.10.14', 6, 0.00);

INSERT INTO wallet_wallet (id, user_id, balance, is_active, created_at, updated_at) VALUES
(1, 2, 320.00, TRUE, NOW(), NOW()),
(2, 3, 140.00, TRUE, NOW(), NOW()),
(3, 4,  60.00, TRUE, NOW(), NOW()),
(4, 5, 480.00, TRUE, NOW(), NOW()),
(5, 6, 210.00, TRUE, NOW(), NOW());

INSERT INTO wallet_meterbalance (id, user_id, meter_id, meter_number, balance, is_active, created_at, updated_at) VALUES
(1, 2, 1, '1234567890', 320.00, TRUE, NOW(), NOW()),
(2, 3, 2, '1234567891', 140.00, TRUE, NOW(), NOW()),
(3, 4, 3, '1234567892',  60.00, TRUE, NOW(), NOW()),
(4, 5, 4, '1234567893', 480.00, TRUE, NOW(), NOW()),
(5, 6, 5, '1234567894', 210.00, TRUE, NOW(), NOW());

-- ---------------------------------------------------------------------------
-- Loan scenarios
-- ---------------------------------------------------------------------------
-- Jane: DISBURSED (active outstanding)
INSERT INTO loan_loanapplication (
    id, created_at, updated_at, loan_id, user_id, purpose, amount_requested, amount_approved,
    tenure_months, interest_rate, status, credit_score, loan_tier, tariff_id, rejection_reason, user_notified
) VALUES
(1, NOW() - INTERVAL '20 day', NOW() - INTERVAL '15 day', 'LNJANE001A', 2, 'Emergency top-up', 80000.00, 80000.00, 2, 11.00, 'DISBURSED', 82, 'SILVER', 1, NULL, TRUE),
-- John: APPROVED (not disbursed)
(2, NOW() - INTERVAL '9 day', NOW() - INTERVAL '8 day', 'LNJOHN002B', 3, 'Monthly support', 50000.00, 50000.00, 1, 12.00, 'APPROVED', 77, 'BRONZE', 1, NULL, FALSE),
-- Mary: REJECTED
(3, NOW() - INTERVAL '7 day', NOW() - INTERVAL '7 day', 'LNMARY003C', 4, 'Household power', 45000.00, NULL, 1, 12.00, 'REJECTED', 62, NULL, 1, 'Credit score below 75%', TRUE),
-- Peter: COMPLETED
(4, NOW() - INTERVAL '60 day', NOW() - INTERVAL '25 day', 'LNPETE004D', 5, 'Business operations', 150000.00, 150000.00, 3, 10.00, 'COMPLETED', 88, 'GOLD', 2, NULL, TRUE),
-- Amina: DEFAULTED
(5, NOW() - INTERVAL '90 day', NOW() - INTERVAL '40 day', 'LNAMIN005E', 6, 'School fees electricity', 100000.00, 100000.00, 1, 11.00, 'DEFAULTED', 81, 'SILVER', 1, NULL, TRUE);

INSERT INTO loan_loandisbursement (id, created_at, updated_at, loan_application_id, disbursement_date, disbursed_amount, units_disbursed, token, token_expiry, meter_id) VALUES
(1, NOW() - INTERVAL '15 day', NOW() - INTERVAL '15 day', 1, NOW() - INTERVAL '15 day',  80000.00, 143.00, '8899776655', NOW() + INTERVAL '15 day', 1),
(2, NOW() - INTERVAL '55 day', NOW() - INTERVAL '55 day', 4, NOW() - INTERVAL '55 day', 150000.00, 215.00, '2233445566', NOW() - INTERVAL '25 day', 4),
(3, NOW() - INTERVAL '80 day', NOW() - INTERVAL '80 day', 5, NOW() - INTERVAL '80 day', 100000.00, 172.00, '6677889900', NOW() - INTERVAL '50 day', 5);

INSERT INTO loan_loanrepayment (
    id, created_at, updated_at, loan_id, amount_paid, payment_date, units_paid, is_on_time,
    payment_reference, payment_method, momo_transaction_id, momo_external_id, momo_phone_number, payment_status
) VALUES
-- Jane partial repayments
(1, NOW() - INTERVAL '12 day', NOW() - INTERVAL '12 day', 1, 20000.00, NOW() - INTERVAL '12 day', 33.33, TRUE, 'R-J-0001', 'MOBILE_MONEY', NULL, 'EXT-J-0001', '+256701234567', 'SUCCESS'),
(2, NOW() - INTERVAL '5 day',  NOW() - INTERVAL '5 day',  1, 15000.00, NOW() - INTERVAL '5 day',  25.00, TRUE, 'R-J-0002', 'MOBILE_MONEY', NULL, 'EXT-J-0002', '+256701234567', 'SUCCESS'),
-- Peter fully repaid
(3, NOW() - INTERVAL '45 day', NOW() - INTERVAL '45 day', 4, 75000.00, NOW() - INTERVAL '45 day', 107.14, TRUE, 'R-P-0001', 'BANK_TRANSFER', NULL, 'EXT-P-0001', NULL, 'SUCCESS'),
(4, NOW() - INTERVAL '30 day', NOW() - INTERVAL '30 day', 4, 85000.00, NOW() - INTERVAL '30 day', 121.43, TRUE, 'R-P-0002', 'BANK_TRANSFER', NULL, 'EXT-P-0002', NULL, 'SUCCESS'),
-- Amina low repayment then default
(5, NOW() - INTERVAL '65 day', NOW() - INTERVAL '65 day', 5, 10000.00, NOW() - INTERVAL '65 day', 16.67, FALSE, 'R-A-0001', 'MOBILE_MONEY', NULL, 'EXT-A-0001', '+256704444444', 'SUCCESS');

-- ---------------------------------------------------------------------------
-- Purchase transactions and unit transactions
-- ---------------------------------------------------------------------------
INSERT INTO transactions_transaction (id, create_date, modify_date, transaction_id, wallet_id, amount, status, phone_number, message, transaction_reference) VALUES
(1, NOW() - INTERVAL '4 day', NOW() - INTERVAL '4 day', 'TRX000000001', 2, 30000.00, 'COMPLETED', '+256701234567', 'Buy units - completed', 'EXT-BUY-0001'),
(2, NOW() - INTERVAL '3 day', NOW() - INTERVAL '3 day', 'TRX000000002', 3, 15000.00, 'FAILED',    '+256701111111', 'Buy units - failed',    'EXT-BUY-0002'),
(3, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day', 'TRX000000003', 5, 50000.00, 'COMPLETED', '+256703333333', 'Buy units - completed', 'EXT-BUY-0003'),
(4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'TRX000000004', 6, 25000.00, 'PENDING',   '+256704444444', 'Buy units - pending',   'EXT-BUY-0004');

INSERT INTO transactions_unittransaction (id, create_date, modify_date, transaction_id, sender_id, receiver_id, units, meter_id, direction, status, message) VALUES
(1, NOW() - INTERVAL '4 day', NOW() - INTERVAL '4 day', 'UTX000000000001', 2, 2, 56.50, NULL, 'IN',  'COMPLETED', 'Jane purchase'),
(2, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day', 'UTX000000000002', 5, 5, 72.00, NULL, 'IN',  'COMPLETED', 'Peter purchase'),
(3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'UTX000000000003', 2, 3, 10.00, NULL, 'OUT', 'COMPLETED', 'Jane shared to John'),
(4, NOW() - INTERVAL '8 hour',NOW() - INTERVAL '8 hour','UTX000000000004', 5, 6, 15.00, NULL, 'OUT', 'COMPLETED', 'Peter shared to Amina');

INSERT INTO transactions_transactionlog (id, user_id, transaction_type, amount, units, status, reference_id, details, created_at) VALUES
(1, 2, 'UNIT_PURCHASE', 30000.00, 56.50, 'COMPLETED', 'TRX000000001', '{"channel":"HEAVY_SEED"}', NOW() - INTERVAL '4 day'),
(2, 2, 'LOAN_APPLICATION', 80000.00, NULL, 'APPROVED', 'LNJANE001A', '{"tier":"SILVER"}', NOW() - INTERVAL '20 day'),
(3, 2, 'LOAN_DISBURSEMENT', 80000.00, 143.00, 'COMPLETED', 'LNJANE001A', '{"channel":"HEAVY_SEED"}', NOW() - INTERVAL '15 day'),
(4, 5, 'LOAN_COMPLETION', NULL, NULL, 'COMPLETED', 'LNPETE004D', '{"channel":"HEAVY_SEED"}', NOW() - INTERVAL '25 day'),
(5, 6, 'LOAN_REPAYMENT', 10000.00, 16.67, 'COMPLETED', 'LNAMIN005E', '{"channel":"HEAVY_SEED"}', NOW() - INTERVAL '65 day'),
(6, 2, 'UNIT_SHARE', NULL, 10.00, 'COMPLETED', 'SHARE-A1000001', '{"receiver_meter":"1234567891"}', NOW() - INTERVAL '1 day'),
(7, 5, 'UNIT_SHARE', NULL, 15.00, 'COMPLETED', 'SHARE-A1000002', '{"receiver_meter":"1234567894"}', NOW() - INTERVAL '8 hour');

-- Wallet app ledgers
INSERT INTO wallet_transaction (id, wallet_id, amount, transaction_type, balance_after, description, reference, metadata, created_at) VALUES
(1, 1, 56.50, 'CREDIT', 320.00, 'Purchased units',      'WTX-J-0001', '{"src":"purchase"}', NOW() - INTERVAL '4 day'),
(2, 1, 10.00, 'DEBIT',  310.00, 'Share to John',        'WTX-J-0002', '{"src":"share"}',    NOW() - INTERVAL '1 day'),
(3, 2, 10.00, 'CREDIT', 140.00, 'Share from Jane',      'WTX-O-0003', '{"src":"share"}',    NOW() - INTERVAL '1 day'),
(4, 4, 72.00, 'CREDIT', 480.00, 'Purchased units',      'WTX-P-0004', '{"src":"purchase"}', NOW() - INTERVAL '2 day'),
(5, 4, 15.00, 'DEBIT',  465.00, 'Share to Amina',       'WTX-P-0005', '{"src":"share"}',    NOW() - INTERVAL '8 hour'),
(6, 5, 15.00, 'CREDIT', 210.00, 'Share from Peter',     'WTX-A-0006', '{"src":"share"}',    NOW() - INTERVAL '8 hour');

INSERT INTO wallet_metertransaction (id, meter_id, amount, operation, balance_after, description, reference, created_at) VALUES
(1, 1, 56.50, 'ADD',      320.00, 'Purchased units',   'MTR-J-0001', NOW() - INTERVAL '4 day'),
(2, 1, 10.00, 'SHARE_OUT',310.00, 'Shared out',        'MTR-J-0002', NOW() - INTERVAL '1 day'),
(3, 2, 10.00, 'SHARE_IN', 140.00, 'Received from Jane','MTR-O-0003', NOW() - INTERVAL '1 day'),
(4, 4, 72.00, 'ADD',      480.00, 'Purchased units',   'MTR-P-0004', NOW() - INTERVAL '2 day'),
(5, 4, 15.00, 'SHARE_OUT',465.00, 'Shared out',        'MTR-P-0005', NOW() - INTERVAL '8 hour'),
(6, 5, 15.00, 'SHARE_IN', 210.00, 'Received from Peter','MTR-A-0006',NOW() - INTERVAL '8 hour');

-- ---------------------------------------------------------------------------
-- Share scenarios
-- ---------------------------------------------------------------------------
INSERT INTO share_sharetransaction (
    id, create_date, modify_date, share_transaction_id, sender_id, receiver_id, units, meter_send_id,
    meter_receive_id, direction, status, message, ip_address, user_agent, verified_at
) VALUES
(1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'SHARE-A1000001', 2, 3, 10.00, 1, 2, 'OUT', 'COMPLETED', 'Jane -> John',   '127.0.0.1', 'heavy-seed', NOW() - INTERVAL '1 day'),
(2, NOW() - INTERVAL '8 hour',NOW() - INTERVAL '8 hour','SHARE-A1000002', 5, 6, 15.00, 4, 5, 'OUT', 'COMPLETED', 'Peter -> Amina', '127.0.0.1', 'heavy-seed', NOW() - INTERVAL '8 hour'),
(3, NOW() - INTERVAL '20 min',NOW() - INTERVAL '20 min','SHARE-A1000003', 2, 6,  5.00, 1, 5, 'OUT', 'PENDING',   'Pending OTP',    '127.0.0.1', 'heavy-seed', NULL),
(4, NOW() - INTERVAL '40 min',NOW() - INTERVAL '40 min','SHARE-A1000004', 3, 2,  7.00, 2, 1, 'OUT', 'CANCELLED', 'Cancelled flow', '127.0.0.1', 'heavy-seed', NULL);

INSERT INTO share_share (
    id, create_date, modify_date, share_transaction_id, wallet_id, units, status, meter_number_id, message,
    share_transaction_reference, is_verified, verification_code
) VALUES
(1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'SHARE-A1000001', 2, 10.00, 'COMPLETED', 2, 'Completed share', 'SHARE-A1000001', TRUE, NULL),
(2, NOW() - INTERVAL '8 hour',NOW() - INTERVAL '8 hour','SHARE-A1000002', 5, 15.00, 'COMPLETED', 5, 'Completed share', 'SHARE-A1000002', TRUE, NULL);

-- ---------------------------------------------------------------------------
-- Multi-token history
-- ---------------------------------------------------------------------------
INSERT INTO meter_metertoken (
    id, create_date, modify_date, user_id, token, units, meter_id, is_used, source,
    loan_application_id, share_transaction_id, share_sender_id
) VALUES
(1, NOW() - INTERVAL '15 day', NOW() - INTERVAL '15 day', 2, '1000000001', 20.00, 1, FALSE, 'LOAN',     1, NULL,          NULL),
(2, NOW() - INTERVAL '14 day', NOW() - INTERVAL '14 day', 2, '1000000002', 15.00, 1, TRUE,  'LOAN',     1, NULL,          NULL),
(3, NOW() - INTERVAL '10 day', NOW() - INTERVAL '10 day', 5, '1000000003', 25.00, 4, FALSE, 'PURCHASE', NULL, NULL,       NULL),
(4, NOW() - INTERVAL '8 hour', NOW() - INTERVAL '8 hour', 6, '1000000004', 15.00, 5, FALSE, 'SHARE',    NULL, 'SHARE-A1000002', 5),
(5, NOW() - INTERVAL '6 hour', NOW() - INTERVAL '6 hour', 2, '1000000005',  5.00, 1, FALSE, 'SHARE',    NULL, 'SHARE-A1000001', 2),
(6, NOW() - INTERVAL '2 day',  NOW() - INTERVAL '2 day', 3, '1000000006', 12.00, 2, TRUE,  'PURCHASE', NULL, NULL,       NULL);

-- ---------------------------------------------------------------------------
-- USSD sessions
-- ---------------------------------------------------------------------------
INSERT INTO ussd_ussdsession (
    id, session_id, service_code, phone_number, user_id, last_text, current_menu, context, is_active, expires_at, created_at, updated_at
) VALUES
(1, 'LOCAL-HVY-001', '*123#', '+256701234567', 2, '2*2*1',     'buy_status',   '{"last_buy_transaction_id": 1, "last_share_ref":"SHARE-A1000003"}', TRUE, NOW() + INTERVAL '10 min', NOW() - INTERVAL '5 min', NOW() - INTERVAL '1 min'),
(2, 'LOCAL-HVY-002', '*123#', '+256703333333', 5, '4*2*0*123456','share_verify_otp','{"last_share_ref":"SHARE-A1000002"}', TRUE, NOW() + INTERVAL '8 min', NOW() - INTERVAL '15 min', NOW() - INTERVAL '3 min'),
(3, 'LOCAL-HVY-003', '*123#', '+256704444444', 6, '',          'root',         '{}', TRUE, NOW() + INTERVAL '14 min', NOW() - INTERVAL '1 min', NOW() - INTERVAL '1 min');

-- ---------------------------------------------------------------------------
-- Sequence alignment
-- ---------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('accounts_user', 'id'), COALESCE((SELECT MAX(id) FROM accounts_user), 1), true);
SELECT setval(pg_get_serial_sequence('accounts_profile', 'id'), COALESCE((SELECT MAX(id) FROM accounts_profile), 1), true);
SELECT setval(pg_get_serial_sequence('accounts_useraccountdetails', 'id'), COALESCE((SELECT MAX(id) FROM accounts_useraccountdetails), 1), true);
SELECT setval(pg_get_serial_sequence('accounts_wallet', 'id'), COALESCE((SELECT MAX(id) FROM accounts_wallet), 1), true);
SELECT setval(pg_get_serial_sequence('loan_loantier', 'id'), COALESCE((SELECT MAX(id) FROM loan_loantier), 1), true);
SELECT setval(pg_get_serial_sequence('loan_electricitytariff', 'id'), COALESCE((SELECT MAX(id) FROM loan_electricitytariff), 1), true);
SELECT setval(pg_get_serial_sequence('loan_tariffblock', 'id'), COALESCE((SELECT MAX(id) FROM loan_tariffblock), 1), true);
SELECT setval(pg_get_serial_sequence('loan_usercreditsignal', 'id'), COALESCE((SELECT MAX(id) FROM loan_usercreditsignal), 1), true);
SELECT setval(pg_get_serial_sequence('loan_loanapplication', 'id'), COALESCE((SELECT MAX(id) FROM loan_loanapplication), 1), true);
SELECT setval(pg_get_serial_sequence('loan_loandisbursement', 'id'), COALESCE((SELECT MAX(id) FROM loan_loandisbursement), 1), true);
SELECT setval(pg_get_serial_sequence('loan_loanrepayment', 'id'), COALESCE((SELECT MAX(id) FROM loan_loanrepayment), 1), true);
SELECT setval(pg_get_serial_sequence('meter_meter', 'id'), COALESCE((SELECT MAX(id) FROM meter_meter), 1), true);
SELECT setval(pg_get_serial_sequence('meter_metertoken', 'id'), COALESCE((SELECT MAX(id) FROM meter_metertoken), 1), true);
SELECT setval(pg_get_serial_sequence('wallet_wallet', 'id'), COALESCE((SELECT MAX(id) FROM wallet_wallet), 1), true);
SELECT setval(pg_get_serial_sequence('wallet_meterbalance', 'id'), COALESCE((SELECT MAX(id) FROM wallet_meterbalance), 1), true);
SELECT setval(pg_get_serial_sequence('wallet_transaction', 'id'), COALESCE((SELECT MAX(id) FROM wallet_transaction), 1), true);
SELECT setval(pg_get_serial_sequence('wallet_metertransaction', 'id'), COALESCE((SELECT MAX(id) FROM wallet_metertransaction), 1), true);
SELECT setval(pg_get_serial_sequence('transactions_transaction', 'id'), COALESCE((SELECT MAX(id) FROM transactions_transaction), 1), true);
SELECT setval(pg_get_serial_sequence('transactions_unittransaction', 'id'), COALESCE((SELECT MAX(id) FROM transactions_unittransaction), 1), true);
SELECT setval(pg_get_serial_sequence('transactions_transactionlog', 'id'), COALESCE((SELECT MAX(id) FROM transactions_transactionlog), 1), true);
SELECT setval(pg_get_serial_sequence('share_sharetransaction', 'id'), COALESCE((SELECT MAX(id) FROM share_sharetransaction), 1), true);
SELECT setval(pg_get_serial_sequence('share_share', 'id'), COALESCE((SELECT MAX(id) FROM share_share), 1), true);
SELECT setval(pg_get_serial_sequence('ussd_ussdsession', 'id'), COALESCE((SELECT MAX(id) FROM ussd_ussdsession), 1), true);

COMMIT;
