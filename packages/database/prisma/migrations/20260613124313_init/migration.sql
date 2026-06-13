-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_MFA', 'FORCE_PASSWORD_CHANGE');

-- CreateEnum
CREATE TYPE "VaultSecretType" AS ENUM ('api_key', 'oauth_token', 'webhook_secret', 'database_url', 'encryption_key', 'certificate', 'custom');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'critical', 'security');

-- CreateEnum
CREATE TYPE "OAuthStatus" AS ENUM ('connected', 'disconnected', 'error', 'expired');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('information', 'excel_attachment', 'invoice', 'payment', 'candidate', 'client', 'lead', 'news', 'legal', 'support', 'technical_error', 'github_notification', 'bank_notification', 'calendar_invite', 'supplier', 'spam_or_low_priority', 'unknown');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'analyzing', 'preview_ready', 'approved', 'running', 'completed', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('pending', 'approved', 'rejected', 'archived', 'obsolete', 'replaced');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'FORCE_PASSWORD_CHANGE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "vault_secrets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "VaultSecretType" NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "module" TEXT,
    "expiresAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_apps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "module" TEXT,
    "platform" TEXT,
    "provider" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "riskLevel" "AuditSeverity" NOT NULL DEFAULT 'info',
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "OAuthStatus" NOT NULL DEFAULT 'connected',
    "scopes" TEXT[],
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "projectId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_gmail_watchers" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "historyId" TEXT,
    "expiration" TIMESTAMP(3),
    "pubSubTopic" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_gmail_watchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_gmail_events" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "category" TEXT,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "agentAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_gmail_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_drive_files" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT,
    "parentFolderId" TEXT,
    "webViewLink" TEXT,
    "classification" TEXT,
    "linkedRecordType" TEXT,
    "linkedRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_events" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "summary" TEXT,
    "start" TIMESTAMP(3),
    "end" TIMESTAMP(3),
    "location" TEXT,
    "attendees" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_sheets_connections" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "title" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_sheets_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "tenantId" TEXT,
    "status" "OAuthStatus" NOT NULL DEFAULT 'connected',
    "scopes" TEXT[],
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_graph_subscriptions" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "changeTypes" TEXT[],
    "expirationAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microsoft_graph_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_mail_events" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT,
    "fromName" TEXT,
    "category" TEXT,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "agentAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microsoft_mail_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_onedrive_files" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "driveItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT,
    "parentPath" TEXT,
    "webUrl" TEXT,
    "classification" TEXT,
    "linkedRecordType" TEXT,
    "linkedRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microsoft_onedrive_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_calendar_events" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "subject" TEXT,
    "start" TIMESTAMP(3),
    "end" TIMESTAMP(3),
    "location" TEXT,
    "attendees" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microsoft_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microsoft_excel_workbooks" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "driveItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "webUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microsoft_excel_workbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "subject" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "toEmails" TEXT[],
    "category" "EmailCategory" NOT NULL DEFAULT 'unknown',
    "summary" TEXT,
    "urgency" TEXT,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "agentActions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "driveFileId" TEXT,
    "oneDriveId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_agent_actions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_routing_rules" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_response_suggestions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_response_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT,
    "displayName" TEXT,
    "status" "OAuthStatus" NOT NULL DEFAULT 'connected',
    "rootFolderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_folders" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "parentId" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_files" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "folderId" TEXT,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" BIGINT,
    "webUrl" TEXT,
    "classification" TEXT,
    "linkedRecordType" TEXT,
    "linkedRecordId" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_processing_jobs" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "file_processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_extensions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowedDomains" TEXT[],
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "browser_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_extension_sessions" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browser_extension_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "browser_extension_events" (
    "id" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "selection" TEXT,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "browser_extension_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER,
    "processedRows" INTEGER,
    "errorRows" INTEGER,
    "mappings" JSONB,
    "validationErrors" JSONB,
    "previewData" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_runs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rowsInserted" INTEGER,
    "rowsUpdated" INTEGER,
    "rowsSkipped" INTEGER,
    "errors" JSONB,
    "backupId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "data_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB,
    "destination" TEXT,
    "status" "ExportStatus" NOT NULL DEFAULT 'pending',
    "rowCount" INTEGER,
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_backups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" BIGINT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "triggeredBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_restore_jobs" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_restore_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_sync_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_sync_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_sync_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rowsProcessed" INTEGER,
    "rowsError" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "database_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "linkedType" TEXT,
    "linkedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversations" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "agentGenerated" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "description" TEXT,
    "permittedActions" TEXT[],
    "forbiddenActions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxTokensPerRun" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT,
    "memoryType" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "status" "MemoryStatus" NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "replacedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_experience_logs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "tokensUsed" INTEGER,
    "durationMs" INTEGER,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_experience_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_ecosystem_memory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "sources" TEXT[],
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_ecosystem_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "platform" TEXT,
    "formula" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "vault_secrets_name_key" ON "vault_secrets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "connected_apps_name_key" ON "connected_apps"("name");

-- CreateIndex
CREATE UNIQUE INDEX "connected_apps_slug_key" ON "connected_apps"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_provider_email_key" ON "email_accounts"("provider", "email");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_providerId_phone_key" ON "whatsapp_contacts"("providerId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "agent_definitions_name_key" ON "agent_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shared_ecosystem_memory_key_key" ON "shared_ecosystem_memory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_name_key" ON "kpi_definitions"("name");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_gmail_watchers" ADD CONSTRAINT "google_gmail_watchers_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_drive_files" ADD CONSTRAINT "google_drive_files_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_events" ADD CONSTRAINT "google_calendar_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_sheets_connections" ADD CONSTRAINT "google_sheets_connections_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microsoft_graph_subscriptions" ADD CONSTRAINT "microsoft_graph_subscriptions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "microsoft_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microsoft_mail_events" ADD CONSTRAINT "microsoft_mail_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "microsoft_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microsoft_onedrive_files" ADD CONSTRAINT "microsoft_onedrive_files_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "microsoft_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microsoft_calendar_events" ADD CONSTRAINT "microsoft_calendar_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "microsoft_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microsoft_excel_workbooks" ADD CONSTRAINT "microsoft_excel_workbooks_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "microsoft_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_agent_actions" ADD CONSTRAINT "email_agent_actions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_routing_rules" ADD CONSTRAINT "email_routing_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "drive_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "drive_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "drive_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_processing_jobs" ADD CONSTRAINT "file_processing_jobs_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "drive_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_extension_sessions" ADD CONSTRAINT "browser_extension_sessions_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "browser_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_extension_sessions" ADD CONSTRAINT "browser_extension_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "browser_extension_events" ADD CONSTRAINT "browser_extension_events_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "browser_extensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_runs" ADD CONSTRAINT "data_import_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "data_import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_jobs" ADD CONSTRAINT "data_export_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_sync_runs" ADD CONSTRAINT "database_sync_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "database_sync_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "whatsapp_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "whatsapp_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "whatsapp_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "whatsapp_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_experience_logs" ADD CONSTRAINT "agent_experience_logs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "kpi_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
