-- Rebrand: plan names follow The Curious Library
update subscription_plans set name = replace(name, 'Bonkers', 'Curious') where name like '%Bonkers%';
