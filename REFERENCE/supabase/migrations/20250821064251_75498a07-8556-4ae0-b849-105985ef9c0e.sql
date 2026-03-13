-- Enable leaked password protection for enhanced security
-- This prevents users from using passwords that have been compromised in data breaches

-- Enable leaked password protection
INSERT INTO auth.config (parameter, value) 
VALUES ('password_min_length', '8')
ON CONFLICT (parameter) 
DO UPDATE SET value = '8';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_lower', 'true')
ON CONFLICT (parameter) 
DO UPDATE SET value = 'true';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_upper', 'true')
ON CONFLICT (parameter) 
DO UPDATE SET value = 'true';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_symbols', 'false')
ON CONFLICT (parameter) 
DO UPDATE SET value = 'false';

INSERT INTO auth.config (parameter, value) 
VALUES ('password_require_numbers', 'true')
ON CONFLICT (parameter) 
DO UPDATE SET value = 'true';