ALTER POLICY tenant_isolation ON "tenants"
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "users"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "employer_profiles"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "eea_events"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "eea2_drafts"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "eea1_declarations"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "sessions"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);

ALTER POLICY tenant_isolation ON "notifications"
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true)::uuid);
