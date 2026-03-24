ALTER TABLE readiness_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY readiness_assessments_service_all
ON readiness_assessments
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

