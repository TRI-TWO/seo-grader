-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VISITOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VISITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditResult" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "hasAppointment" BOOLEAN NOT NULL DEFAULT false,
    "rawSeoJson" JSONB NOT NULL,
    "llmSummary" TEXT,
    "contentGrade" TEXT,
    "competitorJson" JSONB,
    "articleIdeas" JSONB,
    "companyName" TEXT,
    "titleSearchRelevanceScore" INTEGER,
    "technicalFoundationsScore" INTEGER,
    "aiOptimizationScore" INTEGER,
    "contentSemanticsScore" INTEGER,
    "mediaOptimizationScore" INTEGER,
    "crawlabilityIndexScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendlyAppointment" (
    "id" TEXT NOT NULL,
    "calendlyEventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "auditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendlyAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "squarePlanId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionPlanId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditJob" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "errorMessage" TEXT,
    "results" JSONB,

    CONSTRAINT "AuditJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CalendlyAppointment_calendlyEventId_key" ON "CalendlyAppointment"("calendlyEventId");

-- CreateIndex
CREATE INDEX "AuditJob_url_status_createdAt_idx" ON "AuditJob"("url", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditJob_status_idx" ON "AuditJob"("status");

-- AddForeignKey
ALTER TABLE "AuditResult" ADD CONSTRAINT "AuditResult_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendlyAppointment" ADD CONSTRAINT "CalendlyAppointment_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendlyAppointment" ADD CONSTRAINT "CalendlyAppointment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

