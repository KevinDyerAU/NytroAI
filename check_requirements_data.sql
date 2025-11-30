-- Check if requirement text exists in database tables
-- This script will help identify if the data was scraped correctly

-- Check Knowledge Evidence Requirements
SELECT 
    'knowledge_evidence' as table_name,
    COUNT(*) as total_records,
    COUNT(knowledge_point) as has_knowledge_point,
    COUNT(CASE WHEN knowledge_point IS NOT NULL AND knowledge_point != '' THEN 1 END) as has_non_empty_text,
    COUNT(ke_number) as has_number
FROM knowledge_evidence_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025';

-- Check Performance Evidence Requirements
SELECT 
    'performance_evidence' as table_name,
    COUNT(*) as total_records,
    COUNT(performance_task) as has_performance_task,
    COUNT(CASE WHEN performance_task IS NOT NULL AND performance_task != '' THEN 1 END) as has_non_empty_text,
    COUNT(pe_number) as has_number
FROM performance_evidence_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025';

-- Check Foundation Skills Requirements
SELECT 
    'foundation_skills' as table_name,
    COUNT(*) as total_records,
    COUNT(skill_description) as has_skill_description,
    COUNT(CASE WHEN skill_description IS NOT NULL AND skill_description != '' THEN 1 END) as has_non_empty_text,
    COUNT(fs_number) as has_number
FROM foundation_skills_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025';

-- Check Performance Criteria Requirements (these are working)
SELECT 
    'elements_performance_criteria' as table_name,
    COUNT(*) as total_records,
    COUNT(performance_criteria) as has_performance_criteria,
    COUNT(CASE WHEN performance_criteria IS NOT NULL AND performance_criteria != '' THEN 1 END) as has_non_empty_text,
    COUNT(epc_number) as has_number
FROM elements_performance_criteria_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025';

-- Sample actual data from each table
SELECT 'KE Sample' as type, id, ke_number, knowledge_point, unit_url
FROM knowledge_evidence_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025'
LIMIT 3;

SELECT 'PE Sample' as type, id, pe_number, performance_task, unit_url
FROM performance_evidence_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025'
LIMIT 3;

SELECT 'FS Sample' as type, id, fs_number, skill_description, unit_url
FROM foundation_skills_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025'
LIMIT 3;

SELECT 'PC Sample' as type, id, epc_number, performance_criteria, element, unit_url
FROM elements_performance_criteria_requirements
WHERE unit_url = 'https://training.gov.au/Training/Details/TLIF0025'
LIMIT 3;
