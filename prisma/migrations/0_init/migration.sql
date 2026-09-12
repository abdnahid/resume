-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgCategory" AS ENUM ('wing', 'divisional', 'regional', 'unit');

-- CreateEnum
CREATE TYPE "PostingStatus" AS ENUM ('pending', 'active');

-- CreateEnum
CREATE TYPE "PostingType" AS ENUM ('initial', 'transfer', 'promotion', 'demotion', 'deputation', 'lien');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('superadmin', 'officeadmin', 'office_head', 'data_entry', 'case_officer', 'lab_entry', 'one_stop', 'employee', 'client');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INTERNAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "OfficeType" AS ENUM ('head', 'divisional', 'district', 'regional', 'dmi');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('officer', 'staff', 'daily_basis', 'outsourcing');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'retired', 'prl', 'inactive');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('active', 'expired', 'not_found', 'inactive');

-- CreateEnum
CREATE TYPE "SalaryHeadKind" AS ENUM ('earning', 'deduction');

-- CreateEnum
CREATE TYPE "SalaryHeadBasis" AS ENUM ('fixed', 'percent_of_basic', 'house_rent_rule');

-- CreateEnum
CREATE TYPE "FixationReason" AS ENUM ('annual', 'initial', 'increment', 'promotion', 'punishment', 'correction');

-- CreateEnum
CREATE TYPE "CaseForum" AS ENUM ('departmental', 'administrative_tribunal', 'civil_court', 'criminal_court', 'high_court', 'appellate_division');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('open', 'under_trial', 'verdict_given', 'under_appeal', 'closed');

-- CreateEnum
CREATE TYPE "VerdictClauseType" AS ENUM ('reduce_increments', 'withhold_increment', 'demote_grade', 'basic_percent', 'suppress_allowances', 'suppress_head');

-- CreateEnum
CREATE TYPE "HouseRentZone" AS ENUM ('dhaka', 'divisional_city', 'other_district');

-- CreateEnum
CREATE TYPE "IdCardBatchStatus" AS ENUM ('pending', 'issued');

-- CreateEnum
CREATE TYPE "IdCardStatus" AS ENUM ('pending', 'active', 'superseded');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'unspecified');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('single', 'married', 'divorced', 'widowed', 'unspecified');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_pos', 'A_neg', 'B_pos', 'B_neg', 'AB_pos', 'AB_neg', 'O_pos', 'O_neg');

-- CreateEnum
CREATE TYPE "WorkHistoryType" AS ENUM ('bsti', 'previous');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('standalone', 'group_parent', 'group_member');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('draft', 'complete', 'archived');

-- CreateEnum
CREATE TYPE "CompanyLegalForm" AS ENUM ('proprietorship', 'partnership', 'limited', 'group_entity');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('org_admin', 'representative', 'viewer');

-- CreateEnum
CREATE TYPE "OrganizationDocumentType" AS ENUM ('trade_licence', 'bin_certificate', 'tin_certificate', 'incorporation', 'memorandum', 'representative_nid', 'factory_layout', 'other');

-- CreateEnum
CREATE TYPE "BdsStatus" AS ENUM ('current', 'superseded', 'withdrawn');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('bds_purchase', 'application_fee', 'testing_fee', 'licence_fee');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'initiated', 'paid', 'failed', 'cancelled', 'expired', 'refunded');

-- CreateEnum
CREATE TYPE "ApplicationState" AS ENUM ('draft', 'pending_app_fee', 'submitted', 'received_by_director', 'in_channel_descending', 'assigned_to_fdo', 'under_review', 'shortfall_issued', 'shortfall_responded', 'review_passed', 'inspection_proposed', 'inspection_pending_approval', 'inspection_revision_requested', 'inspection_approved', 'inspection_scheduled', 'inspection_in_progress', 'inspection_completed', 'inspection_report_submitted', 'awaiting_factory_development', 'test_fee_demanded', 'test_fee_paid', 'sample_partially_received', 'sample_received', 'rejected', 'withdrawn', 'lapsed', 'inspection_failed');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('cm_licence');

-- CreateEnum
CREATE TYPE "SizeKind" AS ENUM ('numeric', 'categorical');

-- CreateEnum
CREATE TYPE "CapacityAuthority" AS ENUM ('bida', 'beza', 'bepza', 'bscic', 'other');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('down', 'up', 'receive', 'reassign');

-- CreateEnum
CREATE TYPE "LabDiscipline" AS ENUM ('physical', 'chemical');

-- CreateEnum
CREATE TYPE "LimitKind" AS ENUM ('rule', 'declared', 'cross_reference', 'unspecified');

-- CreateEnum
CREATE TYPE "UrgentFeeSource" AS ENUM ('doubled', 'doubled_assumed', 'apportioned', 'same_as_normal', 'manual');

-- CreateEnum
CREATE TYPE "CapabilityManner" AS ENUM ('in_house', 'third_party');

-- CreateEnum
CREATE TYPE "DeclaredBy" AS ENUM ('applicant', 'fdo');

-- CreateEnum
CREATE TYPE "SampleState" AS ENUM ('sealed', 'submitted', 'received_at_lab', 'in_test', 'consumed', 'returned', 'rejected');

-- CreateEnum
CREATE TYPE "ConsignmentState" AS ENUM ('packed', 'awaiting_submission', 'submitted', 'received_at_lab', 'rejected');

-- CreateEnum
CREATE TYPE "LabTestOrderState" AS ENUM ('awaiting_sample', 'in_progress', 'reported', 'cancelled');

-- CreateEnum
CREATE TYPE "TestVerdict" AS ENUM ('pass', 'fail', 'inconclusive', 'not_tested');

-- CreateEnum
CREATE TYPE "RequirementSource" AS ENUM ('entered', 'learned');

-- CreateEnum
CREATE TYPE "SampleLetterKind" AS ENUM ('wing_head', 'applicant', 'one_stop');

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "category" "OrgCategory" NOT NULL DEFAULT 'unit',
    "parentId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgPost" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "grade" TEXT,
    "sanctionedCount" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unitId" INTEGER NOT NULL,

    CONSTRAINT "OrgPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" SERIAL NOT NULL,
    "type" "PostingType" NOT NULL DEFAULT 'initial',
    "status" "PostingStatus" NOT NULL DEFAULT 'active',
    "grade" TEXT NOT NULL,
    "joinedAt" TEXT,
    "relievedAt" TEXT,
    "orderNo" TEXT,
    "orderDate" TEXT,
    "remarks" TEXT,
    "selfReported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orgPostId" INTEGER,
    "officeId" INTEGER NOT NULL,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "role" "Role" NOT NULL DEFAULT 'employee',
    "roles" "Role"[],
    "accountType" "AccountType" NOT NULL DEFAULT 'INTERNAL',
    "mobile" TEXT,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "mobileVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" INTEGER NOT NULL,
    "type" "OfficeType" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "houseRentZone" "HouseRentZone",
    "officeHead" TEXT NOT NULL,
    "addressEn" TEXT NOT NULL,
    "addressBn" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "division" TEXT,
    "district" TEXT,
    "upazila" TEXT,
    "cityCorpType" TEXT,
    "cityCorpName" TEXT,
    "ward" TEXT,
    "houseNo" TEXT,
    "road" TEXT,
    "postOffice" TEXT,
    "postCode" TEXT,
    "thana" TEXT,
    "village" TEXT,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "category" "EmployeeCategory" NOT NULL DEFAULT 'staff',
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "fatherNameEn" TEXT NOT NULL,
    "fatherNameBn" TEXT NOT NULL,
    "motherNameEn" TEXT NOT NULL,
    "motherNameBn" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "identityIsProvisional" BOOLEAN NOT NULL DEFAULT false,
    "bloodGroup" "BloodGroup",
    "nid" TEXT,
    "passportNo" TEXT,
    "nationality" TEXT,
    "placeOfBirth" TEXT,
    "signatureLabel" TEXT,
    "photoLabel" TEXT,
    "wing" TEXT,
    "email" TEXT,
    "mobileHome" TEXT,
    "mobileOffice" TEXT,
    "phone" TEXT,
    "emergencyName" TEXT,
    "emergencyRelation" TEXT,
    "emergencyPhone" TEXT,
    "emergencyMobile" TEXT,
    "bankAccountNo" TEXT,
    "bankBranch" TEXT,
    "tinNo" TEXT,
    "designationEn" TEXT,
    "designationBn" TEXT,
    "grade" TEXT,
    "division" TEXT,
    "initialDesignationBn" TEXT,
    "dateOfJoining" TEXT,
    "postRetirementLeave" TEXT,
    "fullRetirement" TEXT,
    "serviceHistoryLocked" BOOLEAN NOT NULL DEFAULT false,
    "profileStatus" TEXT NOT NULL DEFAULT 'draft',
    "profileSubmittedAt" TIMESTAMP(3),
    "profileApprovedAt" TIMESTAMP(3),
    "profileApprovedBy" TEXT,
    "profileRevisionNote" TEXT,
    "orgPostId" INTEGER,
    "orgPostIsInferred" BOOLEAN NOT NULL DEFAULT false,
    "actingOrgPostId" INTEGER,
    "officeId" INTEGER NOT NULL,
    "presentAddressId" INTEGER,
    "permanentAddressId" INTEGER,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayScale" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "incrementNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayScaleStep" (
    "id" SERIAL NOT NULL,
    "grade" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "scaleId" INTEGER NOT NULL,

    CONSTRAINT "PayScaleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseRentRule" (
    "id" SERIAL NOT NULL,
    "zone" "HouseRentZone" NOT NULL,
    "minBasic" INTEGER NOT NULL,
    "maxBasic" INTEGER,
    "percent" INTEGER NOT NULL,
    "minAmount" INTEGER NOT NULL,
    "scaleId" INTEGER NOT NULL,

    CONSTRAINT "HouseRentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttendance" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "note" TEXT,
    "employeeId" TEXT NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWageRate" (
    "id" SERIAL NOT NULL,
    "zone" "HouseRentZone" NOT NULL,
    "amount" INTEGER NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWageRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHead" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "kind" "SalaryHeadKind" NOT NULL,
    "basis" "SalaryHeadBasis" NOT NULL,
    "defaultValue" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryFixation" (
    "id" SERIAL NOT NULL,
    "grade" INTEGER NOT NULL,
    "step" INTEGER,
    "basicSalary" INTEGER NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validThru" TEXT NOT NULL,
    "salaryStatus" "SalaryStatus" NOT NULL DEFAULT 'active',
    "reason" "FixationReason" NOT NULL DEFAULT 'annual',
    "note" TEXT,
    "grossEarning" INTEGER NOT NULL DEFAULT 0,
    "totalDeduction" INTEGER NOT NULL DEFAULT 0,
    "netSalary" INTEGER NOT NULL DEFAULT 0,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "scaleId" INTEGER,
    "verdictId" INTEGER,
    "baselineFixationId" INTEGER,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "SalaryFixation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryFixationItem" (
    "id" SERIAL NOT NULL,
    "kind" "SalaryHeadKind" NOT NULL,
    "basis" "SalaryHeadBasis" NOT NULL,
    "value" INTEGER,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fixationId" INTEGER NOT NULL,
    "headId" INTEGER NOT NULL,

    CONSTRAINT "SalaryFixationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'standalone',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'draft',
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "legalForm" "CompanyLegalForm",
    "parentId" INTEGER,
    "tradeLicenceNo" TEXT,
    "tradeLicenceAuthority" TEXT,
    "tradeLicenceExpiry" TEXT,
    "binNo" TEXT,
    "tinNo" TEXT,
    "addressLine" TEXT,
    "division" TEXT,
    "district" TEXT,
    "upazila" TEXT,
    "postCode" TEXT,
    "repName" TEXT,
    "repDesignation" TEXT,
    "repMobile" TEXT,
    "repEmail" TEXT,
    "repNid" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" SERIAL NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'representative',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factory" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "division" TEXT,
    "district" TEXT NOT NULL,
    "upazila" TEXT,
    "postCode" TEXT,
    "contactName" TEXT,
    "contactMobile" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" INTEGER NOT NULL,
    "bstiOfficeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocument" (
    "id" SERIAL NOT NULL,
    "type" "OrganizationDocumentType" NOT NULL,
    "label" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "organizationId" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeBankAccount" (
    "id" SERIAL NOT NULL,
    "recipientDesignationBn" TEXT NOT NULL,
    "branchNameBn" TEXT NOT NULL,
    "branchAddressBn" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "officeId" INTEGER NOT NULL,
    "bankId" INTEGER NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCase" (
    "id" SERIAL NOT NULL,
    "caseNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "forum" "CaseForum" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'open',
    "filedOn" TEXT NOT NULL,
    "summary" TEXT,
    "closedOn" TEXT,
    "employeeId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseVerdict" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "verdictDate" TEXT NOT NULL,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT,
    "summary" TEXT NOT NULL,
    "reduceDerivedAllowances" BOOLEAN NOT NULL DEFAULT false,
    "revokedOn" TEXT,
    "revokedReason" TEXT,
    "arrearsOrdered" BOOLEAN NOT NULL DEFAULT false,
    "caseId" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerdictClause" (
    "id" SERIAL NOT NULL,
    "type" "VerdictClauseType" NOT NULL,
    "value" INTEGER,
    "headId" INTEGER,
    "verdictId" INTEGER NOT NULL,

    CONSTRAINT "VerdictClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryArrear" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "fromMonth" TEXT NOT NULL,
    "fromYear" TEXT NOT NULL,
    "toMonth" TEXT NOT NULL,
    "toYear" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidInProcessId" INTEGER,
    "verdictId" INTEGER,
    "employeeId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryArrear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryHistory" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "basic" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryProcess" (
    "id" SERIAL NOT NULL,
    "basicSalary" INTEGER NOT NULL DEFAULT 0,
    "grossEarning" INTEGER NOT NULL DEFAULT 0,
    "totalDeduction" INTEGER NOT NULL DEFAULT 0,
    "netSalary" INTEGER NOT NULL,
    "issueDate" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "daysWorked" INTEGER,
    "dailyRate" INTEGER,
    "arrearAmount" INTEGER NOT NULL DEFAULT 0,
    "fixationId" INTEGER,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "SalaryProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkHistory" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "type" "WorkHistoryType" NOT NULL DEFAULT 'bsti',
    "designationBn" TEXT NOT NULL,
    "designationEn" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "orderNo" TEXT,
    "orderDate" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "WorkHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "degree" TEXT NOT NULL,
    "subject" TEXT,
    "institution" TEXT NOT NULL,
    "board" TEXT,
    "passingYear" TEXT NOT NULL,
    "result" TEXT,
    "gpa" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "designationBn" TEXT NOT NULL,
    "designationEn" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "orderNo" TEXT,
    "orderDate" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT,
    "duration" TEXT,
    "year" TEXT,
    "result" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForeignTraining" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "country" TEXT,
    "institution" TEXT,
    "duration" TEXT,
    "year" TEXT,
    "result" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "ForeignTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "writers" TEXT,
    "year" TEXT,
    "description" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "awardedBy" TEXT,
    "country" TEXT,
    "subject" TEXT,
    "reason" TEXT,
    "year" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAdvice" (
    "id" SERIAL NOT NULL,
    "memoNo" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "chequeNo" TEXT NOT NULL,
    "chequeDate" TEXT NOT NULL,
    "depositDate" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "totalInWords" TEXT NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "officeId" INTEGER,
    "bankNameBn" TEXT,
    "branchNameBn" TEXT,
    "branchAddressBn" TEXT,
    "recipientDesignationBn" TEXT,
    "drawnOnAccountNo" TEXT,

    CONSTRAINT "BankAdvice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorGeneral" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "signatureUrl" TEXT,
    "photoUrl" TEXT,
    "appointedAt" TEXT NOT NULL,
    "relievedAt" TEXT,
    "orderNo" TEXT,
    "orderDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorGeneral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdCardBatch" (
    "id" SERIAL NOT NULL,
    "memoNo" TEXT,
    "status" "IdCardBatchStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TEXT NOT NULL,
    "signedDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "directorGeneralId" INTEGER NOT NULL,

    CONSTRAINT "IdCardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdCard" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "IdCardStatus" NOT NULL DEFAULT 'pending',
    "issueDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "batchId" INTEGER NOT NULL,

    CONSTRAINT "IdCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spouse" (
    "id" SERIAL NOT NULL,
    "nid" TEXT,
    "mobile" TEXT,
    "nameBn" TEXT,
    "nameEn" TEXT,
    "motherNameBn" TEXT,
    "motherNameEn" TEXT,
    "fatherNameBn" TEXT,
    "fatherNameEn" TEXT,
    "dateOfBirth" TEXT,
    "occupation" TEXT,
    "bloodGroup" "BloodGroup",
    "nationality" TEXT,
    "passportNo" TEXT,
    "passportReceivePlace" TEXT,
    "passportReceiveDate" TEXT,
    "passportIssueDate" TEXT,
    "passportExpiryDate" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Spouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "nameBn" TEXT,
    "nameEn" TEXT,
    "dateOfBirth" TEXT,
    "bloodGroup" "BloodGroup",
    "brn" TEXT,
    "nid" TEXT,
    "gender" "Gender",
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" TEXT,
    "comment" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curricular" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "Curricular_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryAction" (
    "id" SERIAL NOT NULL,
    "sl" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "description" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "comment" TEXT,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "DisciplinaryAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdsDivision" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BdsDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bds" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleBn" TEXT,
    "year" INTEGER NOT NULL,
    "publishedOn" TIMESTAMP(3),
    "edition" TEXT,
    "pages" INTEGER,
    "priceBdt" INTEGER NOT NULL,
    "status" "BdsStatus" NOT NULL DEFAULT 'current',
    "divisionId" INTEGER NOT NULL,
    "supersededById" INTEGER,
    "isMandatory315" BOOLEAN NOT NULL DEFAULT false,
    "isFromMandatoryList" BOOLEAN NOT NULL DEFAULT false,
    "priceIsPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "pdfUrl" TEXT,
    "pdfObjectKey" TEXT,
    "pdfBytes" INTEGER,
    "pdfSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "incomePoisha" INTEGER NOT NULL,
    "vatPoisha" INTEGER NOT NULL,
    "totalPoisha" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 1500,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "providerRef" TEXT,
    "method" TEXT,
    "settledPoisha" INTEGER,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "payerUserId" TEXT NOT NULL,
    "organizationId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachToApplicationId" INTEGER,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "PaymentStatus",
    "note" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdsPurchase" (
    "id" SERIAL NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "bdsId" INTEGER NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "organizationId" INTEGER,
    "paymentId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedByApplicationId" INTEGER,

    CONSTRAINT "BdsPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxGatewayTxn" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "gatewayTxnId" TEXT NOT NULL,
    "amountPoisha" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'created',
    "method" TEXT,
    "returnUrl" TEXT,
    "cancelUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "SandboxGatewayTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "applicationNo" TEXT,
    "service" "ServiceKind" NOT NULL DEFAULT 'cm_licence',
    "state" "ApplicationState" NOT NULL DEFAULT 'draft',
    "organizationId" INTEGER NOT NULL,
    "factoryId" INTEGER NOT NULL,
    "bstiOfficeId" INTEGER,
    "applicationFeePaymentId" INTEGER,
    "consentAcceptedAt" TIMESTAMP(3),
    "consentAcceptedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" INTEGER,
    "holderEmployeeId" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "state" "ApplicationState",
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "letter" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "serial" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "genericNames" TEXT[],
    "bdsId" INTEGER,
    "categoryId" INTEGER NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStandard" (
    "productId" INTEGER NOT NULL,
    "bdsId" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "asPrinted" TEXT,

    CONSTRAINT "ProductStandard_pkey" PRIMARY KEY ("productId","bdsId")
);

-- CreateTable
CREATE TABLE "SizeType" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "kind" "SizeKind" NOT NULL DEFAULT 'numeric',
    "hintEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SizeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SizeUnit" (
    "id" SERIAL NOT NULL,
    "sizeTypeId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SizeUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSku" (
    "id" SERIAL NOT NULL,
    "applicationSubProductId" INTEGER NOT NULL,
    "declaredBy" "DeclaredBy" NOT NULL DEFAULT 'applicant',
    "declaredByEmployeeId" TEXT,
    "notInProductionAt" TIMESTAMP(3),
    "notInProductionByEmployeeId" TEXT,
    "notInProductionNote" TEXT,
    "brandName" TEXT NOT NULL,
    "variant" TEXT,
    "sizeTypeId" INTEGER NOT NULL,
    "sizeUnitId" INTEGER NOT NULL,
    "sizeValue" DECIMAL(12,3),
    "packaging" TEXT,
    "unitsPerPack" INTEGER,
    "grade" TEXT,
    "labelImageName" TEXT,
    "labelImageSizeBytes" INTEGER,
    "labelImageMime" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationProduction" (
    "applicationId" INTEGER NOT NULL,
    "authority" "CapacityAuthority" NOT NULL,
    "registrationNo" TEXT,
    "annualCapacityValue" DECIMAL(16,3) NOT NULL,
    "capacityUnitId" INTEGER NOT NULL,
    "currentYearLabel" TEXT NOT NULL,
    "currentYearProduction" DECIMAL(16,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationProduction_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "questionKey" TEXT NOT NULL,
    "answerText" TEXT,
    "answerNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationMovement" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "fromEmployeeId" TEXT,
    "toEmployeeId" TEXT NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestMethod" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "bdsId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubProduct" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "standardAsPrinted" TEXT,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "foldedAt" TIMESTAMP(3),
    "foldedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bdsId" INTEGER,

    CONSTRAINT "SubProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubProductPackageFee" (
    "subProductId" INTEGER NOT NULL,
    "sourceSection" TEXT NOT NULL,
    "statedNormalFeePoisha" INTEGER,
    "statedUrgentFeePoisha" INTEGER,
    "summedNormalFeePoisha" INTEGER NOT NULL,
    "turnaroundNormalDays" INTEGER,
    "turnaroundUrgentDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubProductPackageFee_pkey" PRIMARY KEY ("subProductId","sourceSection")
);

-- CreateTable
CREATE TABLE "TestParameter" (
    "id" SERIAL NOT NULL,
    "subProductId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "slug" TEXT NOT NULL,
    "methodId" INTEGER,
    "feePoisha" INTEGER NOT NULL,
    "urgentFeePoisha" INTEGER NOT NULL,
    "urgentFeeSource" "UrgentFeeSource" NOT NULL DEFAULT 'doubled_assumed',
    "normalDays" INTEGER,
    "urgentDays" INTEGER,
    "discipline" "LabDiscipline" NOT NULL,
    "sourceSection" TEXT NOT NULL,
    "limitText" TEXT,
    "limitKind" "LimitKind" NOT NULL DEFAULT 'rule',
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSubParameter" (
    "id" SERIAL NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "limitText" TEXT,
    "limitKind" "LimitKind" NOT NULL DEFAULT 'rule',
    "refBdsId" INTEGER,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSubParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT,
    "discipline" "LabDiscipline" NOT NULL,
    "officeId" INTEGER NOT NULL,
    "orgUnitId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeSubProductScope" (
    "officeId" INTEGER NOT NULL,
    "subProductId" INTEGER NOT NULL,
    "declaredByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeSubProductScope_pkey" PRIMARY KEY ("officeId","subProductId")
);

-- CreateTable
CREATE TABLE "ParameterCapability" (
    "officeId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "manner" "CapabilityManner" NOT NULL DEFAULT 'in_house',
    "labId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaredByEmployeeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterCapability_pkey" PRIMARY KEY ("officeId","parameterId")
);

-- CreateTable
CREATE TABLE "RoutingPreference" (
    "officeId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "toOfficeId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingPreference_pkey" PRIMARY KEY ("officeId","parameterId")
);

-- CreateTable
CREATE TABLE "OfficeSampleRequirement" (
    "officeId" INTEGER NOT NULL,
    "subProductId" INTEGER NOT NULL,
    "samplesPerVariant" INTEGER NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreedByEmployeeId" TEXT,
    "note" TEXT,

    CONSTRAINT "OfficeSampleRequirement_pkey" PRIMARY KEY ("officeId","subProductId")
);

-- CreateTable
CREATE TABLE "ApplicationSubProduct" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "subProductId" INTEGER NOT NULL,
    "declaredBy" "DeclaredBy" NOT NULL DEFAULT 'applicant',
    "declaredByEmployeeId" TEXT,
    "notInProductionAt" TIMESTAMP(3),
    "notInProductionByEmployeeId" TEXT,
    "notInProductionNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSubProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationParameterDestination" (
    "applicationSubProductId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "officeId" INTEGER NOT NULL,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chosenByEmployeeId" TEXT,
    "note" TEXT,

    CONSTRAINT "ApplicationParameterDestination_pkey" PRIMARY KEY ("applicationSubProductId","parameterId")
);

-- CreateTable
CREATE TABLE "SampleRequirement" (
    "id" SERIAL NOT NULL,
    "applicationSubProductId" INTEGER NOT NULL,
    "officeId" INTEGER,
    "labId" INTEGER,
    "samplesPerVariant" INTEGER NOT NULL,
    "source" "RequirementSource" NOT NULL DEFAULT 'entered',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consignment" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "officeId" INTEGER,
    "labId" INTEGER,
    "state" "ConsignmentState" NOT NULL DEFAULT 'packed',
    "sealNo" TEXT NOT NULL,
    "packedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packedByEmployeeId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "openedAt" TIMESTAMP(3),
    "openedByEmployeeId" TEXT,
    "sealIntact" BOOLEAN,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" SERIAL NOT NULL,
    "ref" TEXT NOT NULL,
    "labCode" TEXT NOT NULL,
    "labTestOrderId" INTEGER NOT NULL,
    "specimenNo" INTEGER NOT NULL,
    "state" "SampleState" NOT NULL DEFAULT 'sealed',
    "conditionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleRegistration" (
    "id" SERIAL NOT NULL,
    "sampleId" INTEGER NOT NULL,
    "cmCode" TEXT NOT NULL,
    "applicationSkuId" INTEGER NOT NULL,
    "applicationSubProductId" INTEGER NOT NULL,
    "consignmentId" INTEGER NOT NULL,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sealedByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestOrder" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "officeId" INTEGER,
    "labId" INTEGER,
    "subProductId" INTEGER NOT NULL,
    "state" "LabTestOrderState" NOT NULL DEFAULT 'awaiting_sample',
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "dueOn" TIMESTAMP(3),
    "holderEmployeeId" TEXT,
    "reportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTestOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestOrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LabTestOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "sampleId" INTEGER NOT NULL,
    "subParameterId" INTEGER,
    "observedValue" TEXT,
    "verdict" "TestVerdict" NOT NULL DEFAULT 'not_tested',
    "enteredByEmployeeId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEvent" (
    "id" SERIAL NOT NULL,
    "consignmentId" INTEGER NOT NULL,
    "state" "ConsignmentState" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reidentification" (
    "id" SERIAL NOT NULL,
    "sampleId" INTEGER,
    "consignmentId" INTEGER,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reidentification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortfallRound" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "raisedByEmployeeId" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "response" TEXT,

    CONSTRAINT "ShortfallRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortfallItem" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "ShortfallItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPlan" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "proposedByEmployeeId" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "approvedByEmployeeId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "orderNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTeamMember" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "InspectionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionReport" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "preparedByEmployeeId" TEXT NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicantName" TEXT,
    "applicantDesignation" TEXT,
    "govtApprovalOk" BOOLEAN,
    "govtApprovalNote" TEXT,
    "foundCapacityValue" DECIMAL(16,3),
    "foundCapacityUnitId" INTEGER,
    "utilisationPercent" DECIMAL(5,2),
    "unitCostPoisha" INTEGER,
    "remarks" TEXT,
    "samplingRemarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedByEmployeeId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reportNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionConditionCheck" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "satisfactory" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "InspectionConditionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionMarkingCheck" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "InspectionMarkingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionReportAnswer" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "InspectionReportAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryDevelopmentNotice" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "raisedByEmployeeId" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "respondedByUserId" TEXT,
    "response" TEXT,

    CONSTRAINT "FactoryDevelopmentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleLetter" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "kind" "SampleLetterKind" NOT NULL,
    "labId" INTEGER,
    "addressedToEmployeeId" TEXT,
    "officeId" INTEGER,
    "letterNo" TEXT NOT NULL,
    "issuedByEmployeeId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_slug_key" ON "OrgUnit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_presentAddressId_key" ON "Employee"("presentAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_permanentAddressId_key" ON "Employee"("permanentAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayScale_code_key" ON "PayScale"("code");

-- CreateIndex
CREATE INDEX "PayScale_isActive_idx" ON "PayScale"("isActive");

-- CreateIndex
CREATE INDEX "PayScaleStep_scaleId_grade_idx" ON "PayScaleStep"("scaleId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "PayScaleStep_scaleId_grade_step_key" ON "PayScaleStep"("scaleId", "grade", "step");

-- CreateIndex
CREATE INDEX "HouseRentRule_scaleId_zone_idx" ON "HouseRentRule"("scaleId", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "HouseRentRule_scaleId_zone_minBasic_key" ON "HouseRentRule"("scaleId", "zone", "minBasic");

-- CreateIndex
CREATE INDEX "DailyAttendance_month_year_idx" ON "DailyAttendance"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendance_employeeId_month_year_key" ON "DailyAttendance"("employeeId", "month", "year");

-- CreateIndex
CREATE INDEX "DailyWageRate_zone_idx" ON "DailyWageRate"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWageRate_zone_effectiveFrom_key" ON "DailyWageRate"("zone", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryHead_code_key" ON "SalaryHead"("code");

-- CreateIndex
CREATE INDEX "SalaryHead_kind_sortOrder_idx" ON "SalaryHead"("kind", "sortOrder");

-- CreateIndex
CREATE INDEX "SalaryFixation_employeeId_validFrom_idx" ON "SalaryFixation"("employeeId", "validFrom");

-- CreateIndex
CREATE INDEX "SalaryFixation_employeeId_supersededAt_idx" ON "SalaryFixation"("employeeId", "supersededAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryFixationItem_fixationId_headId_key" ON "SalaryFixationItem"("fixationId", "headId");

-- CreateIndex
CREATE INDEX "Organization_type_idx" ON "Organization"("type");

-- CreateIndex
CREATE INDEX "Organization_parentId_idx" ON "Organization"("parentId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Factory_organizationId_idx" ON "Factory"("organizationId");

-- CreateIndex
CREATE INDEX "Factory_bstiOfficeId_idx" ON "Factory"("bstiOfficeId");

-- CreateIndex
CREATE INDEX "OrganizationDocument_organizationId_type_idx" ON "OrganizationDocument"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_nameEn_key" ON "Bank"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeBankAccount_officeId_key" ON "OfficeBankAccount"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCase_caseNo_key" ON "EmployeeCase"("caseNo");

-- CreateIndex
CREATE INDEX "EmployeeCase_employeeId_idx" ON "EmployeeCase"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCase_status_idx" ON "EmployeeCase"("status");

-- CreateIndex
CREATE INDEX "CaseVerdict_caseId_idx" ON "CaseVerdict"("caseId");

-- CreateIndex
CREATE INDEX "VerdictClause_verdictId_idx" ON "VerdictClause"("verdictId");

-- CreateIndex
CREATE INDEX "SalaryArrear_employeeId_paidAt_idx" ON "SalaryArrear"("employeeId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryProcess_employeeId_month_year_key" ON "SalaryProcess"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "BankAdvice_month_year_officeId_key" ON "BankAdvice"("month", "year", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "Spouse_employeeId_key" ON "Spouse"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BdsDivision_slug_key" ON "BdsDivision"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Bds_number_key" ON "Bds"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Bds_slug_key" ON "Bds"("slug");

-- CreateIndex
CREATE INDEX "Bds_divisionId_idx" ON "Bds"("divisionId");

-- CreateIndex
CREATE INDEX "Bds_status_idx" ON "Bds"("status");

-- CreateIndex
CREATE INDEX "Bds_publishedOn_idx" ON "Bds"("publishedOn");

-- CreateIndex
CREATE INDEX "Bds_priceBdt_idx" ON "Bds"("priceBdt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_payerUserId_idx" ON "Payment"("payerUserId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_subjectType_subjectId_idx" ON "Payment"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BdsPurchase_purchaseNumber_key" ON "BdsPurchase"("purchaseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BdsPurchase_paymentId_key" ON "BdsPurchase"("paymentId");

-- CreateIndex
CREATE INDEX "BdsPurchase_buyerUserId_idx" ON "BdsPurchase"("buyerUserId");

-- CreateIndex
CREATE INDEX "BdsPurchase_bdsId_idx" ON "BdsPurchase"("bdsId");

-- CreateIndex
CREATE INDEX "BdsPurchase_organizationId_idx" ON "BdsPurchase"("organizationId");

-- CreateIndex
CREATE INDEX "BdsPurchase_consumedByApplicationId_idx" ON "BdsPurchase"("consumedByApplicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxGatewayTxn_reference_key" ON "SandboxGatewayTxn"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxGatewayTxn_gatewayTxnId_key" ON "SandboxGatewayTxn"("gatewayTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNo_key" ON "Application"("applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationFeePaymentId_key" ON "Application"("applicationFeePaymentId");

-- CreateIndex
CREATE INDEX "Application_organizationId_idx" ON "Application"("organizationId");

-- CreateIndex
CREATE INDEX "Application_factoryId_idx" ON "Application"("factoryId");

-- CreateIndex
CREATE INDEX "Application_productId_idx" ON "Application"("productId");

-- CreateIndex
CREATE INDEX "Application_state_idx" ON "Application"("state");

-- CreateIndex
CREATE INDEX "Application_bstiOfficeId_state_idx" ON "Application"("bstiOfficeId", "state");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_applicationId_kind_key" ON "ApplicationDocument"("applicationId", "kind");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_idx" ON "ApplicationEvent"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_letter_key" ON "ProductCategory"("letter");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_serial_key" ON "Product"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_bdsId_key" ON "Product"("bdsId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductStandard_bdsId_idx" ON "ProductStandard"("bdsId");

-- CreateIndex
CREATE UNIQUE INDEX "SizeType_slug_key" ON "SizeType"("slug");

-- CreateIndex
CREATE INDEX "SizeUnit_sizeTypeId_idx" ON "SizeUnit"("sizeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SizeUnit_sizeTypeId_code_key" ON "SizeUnit"("sizeTypeId", "code");

-- CreateIndex
CREATE INDEX "ApplicationSku_applicationSubProductId_idx" ON "ApplicationSku"("applicationSubProductId");

-- CreateIndex
CREATE INDEX "ApplicationSku_sizeTypeId_idx" ON "ApplicationSku"("sizeTypeId");

-- CreateIndex
CREATE INDEX "ApplicationSku_sizeUnitId_idx" ON "ApplicationSku"("sizeUnitId");

-- CreateIndex
CREATE INDEX "ApplicationProduction_capacityUnitId_idx" ON "ApplicationProduction"("capacityUnitId");

-- CreateIndex
CREATE INDEX "ApplicationAnswer_applicationId_idx" ON "ApplicationAnswer"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_applicationId_questionKey_key" ON "ApplicationAnswer"("applicationId", "questionKey");

-- CreateIndex
CREATE INDEX "ApplicationMovement_applicationId_idx" ON "ApplicationMovement"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationMovement_toEmployeeId_idx" ON "ApplicationMovement"("toEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TestMethod_slug_key" ON "TestMethod"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TestMethod_designation_key" ON "TestMethod"("designation");

-- CreateIndex
CREATE INDEX "TestMethod_bdsId_idx" ON "TestMethod"("bdsId");

-- CreateIndex
CREATE UNIQUE INDEX "SubProduct_slug_key" ON "SubProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SubProduct_productId_nameEn_key" ON "SubProduct"("productId", "nameEn");

-- CreateIndex
CREATE INDEX "TestParameter_slug_idx" ON "TestParameter"("slug");

-- CreateIndex
CREATE INDEX "TestParameter_methodId_idx" ON "TestParameter"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "TestParameter_subProductId_nameEn_key" ON "TestParameter"("subProductId", "nameEn");

-- CreateIndex
CREATE INDEX "TestSubParameter_refBdsId_idx" ON "TestSubParameter"("refBdsId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSubParameter_parameterId_label_key" ON "TestSubParameter"("parameterId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_orgUnitId_key" ON "Lab"("orgUnitId");

-- CreateIndex
CREATE INDEX "Lab_officeId_idx" ON "Lab"("officeId");

-- CreateIndex
CREATE INDEX "Lab_discipline_idx" ON "Lab"("discipline");

-- CreateIndex
CREATE INDEX "OfficeSubProductScope_subProductId_idx" ON "OfficeSubProductScope"("subProductId");

-- CreateIndex
CREATE INDEX "ParameterCapability_parameterId_idx" ON "ParameterCapability"("parameterId");

-- CreateIndex
CREATE INDEX "ParameterCapability_labId_idx" ON "ParameterCapability"("labId");

-- CreateIndex
CREATE INDEX "RoutingPreference_parameterId_idx" ON "RoutingPreference"("parameterId");

-- CreateIndex
CREATE INDEX "RoutingPreference_toOfficeId_idx" ON "RoutingPreference"("toOfficeId");

-- CreateIndex
CREATE INDEX "OfficeSampleRequirement_subProductId_idx" ON "OfficeSampleRequirement"("subProductId");

-- CreateIndex
CREATE INDEX "ApplicationSubProduct_subProductId_idx" ON "ApplicationSubProduct"("subProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSubProduct_applicationId_subProductId_key" ON "ApplicationSubProduct"("applicationId", "subProductId");

-- CreateIndex
CREATE INDEX "ApplicationParameterDestination_parameterId_idx" ON "ApplicationParameterDestination"("parameterId");

-- CreateIndex
CREATE INDEX "ApplicationParameterDestination_officeId_idx" ON "ApplicationParameterDestination"("officeId");

-- CreateIndex
CREATE INDEX "SampleRequirement_officeId_idx" ON "SampleRequirement"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleRequirement_applicationSubProductId_officeId_key" ON "SampleRequirement"("applicationSubProductId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "Consignment_code_key" ON "Consignment"("code");

-- CreateIndex
CREATE INDEX "Consignment_officeId_state_idx" ON "Consignment"("officeId", "state");

-- CreateIndex
CREATE INDEX "Consignment_labId_state_idx" ON "Consignment"("labId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Consignment_applicationId_officeId_key" ON "Consignment"("applicationId", "officeId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_ref_key" ON "Sample"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_labCode_key" ON "Sample"("labCode");

-- CreateIndex
CREATE INDEX "Sample_state_idx" ON "Sample"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_labTestOrderId_specimenNo_key" ON "Sample"("labTestOrderId", "specimenNo");

-- CreateIndex
CREATE UNIQUE INDEX "SampleRegistration_sampleId_key" ON "SampleRegistration"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "SampleRegistration_cmCode_key" ON "SampleRegistration"("cmCode");

-- CreateIndex
CREATE INDEX "SampleRegistration_applicationSkuId_idx" ON "SampleRegistration"("applicationSkuId");

-- CreateIndex
CREATE INDEX "SampleRegistration_applicationSubProductId_idx" ON "SampleRegistration"("applicationSubProductId");

-- CreateIndex
CREATE INDEX "SampleRegistration_consignmentId_idx" ON "SampleRegistration"("consignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestOrder_code_key" ON "LabTestOrder"("code");

-- CreateIndex
CREATE INDEX "LabTestOrder_officeId_state_idx" ON "LabTestOrder"("officeId", "state");

-- CreateIndex
CREATE INDEX "LabTestOrder_subProductId_idx" ON "LabTestOrder"("subProductId");

-- CreateIndex
CREATE INDEX "LabTestOrderItem_parameterId_idx" ON "LabTestOrderItem"("parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestOrderItem_orderId_parameterId_key" ON "LabTestOrderItem"("orderId", "parameterId");

-- CreateIndex
CREATE INDEX "TestResult_sampleId_idx" ON "TestResult"("sampleId");

-- CreateIndex
CREATE INDEX "TestResult_subParameterId_idx" ON "TestResult"("subParameterId");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_orderItemId_sampleId_subParameterId_key" ON "TestResult"("orderItemId", "sampleId", "subParameterId");

-- CreateIndex
CREATE INDEX "CustodyEvent_consignmentId_idx" ON "CustodyEvent"("consignmentId");

-- CreateIndex
CREATE INDEX "Reidentification_actorUserId_idx" ON "Reidentification"("actorUserId");

-- CreateIndex
CREATE INDEX "Reidentification_createdAt_idx" ON "Reidentification"("createdAt");

-- CreateIndex
CREATE INDEX "ShortfallRound_applicationId_idx" ON "ShortfallRound"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortfallRound_applicationId_roundNo_key" ON "ShortfallRound"("applicationId", "roundNo");

-- CreateIndex
CREATE INDEX "ShortfallItem_roundId_idx" ON "ShortfallItem"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortfallItem_roundId_target_key" ON "ShortfallItem"("roundId", "target");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionPlan_applicationId_key" ON "InspectionPlan"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionPlan_orderNo_key" ON "InspectionPlan"("orderNo");

-- CreateIndex
CREATE INDEX "InspectionTeamMember_planId_idx" ON "InspectionTeamMember"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTeamMember_planId_employeeId_key" ON "InspectionTeamMember"("planId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionReport_applicationId_key" ON "InspectionReport"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionReport_reportNo_key" ON "InspectionReport"("reportNo");

-- CreateIndex
CREATE INDEX "InspectionReport_foundCapacityUnitId_idx" ON "InspectionReport"("foundCapacityUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionConditionCheck_reportId_key_key" ON "InspectionConditionCheck"("reportId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionMarkingCheck_reportId_key_key" ON "InspectionMarkingCheck"("reportId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionReportAnswer_reportId_key_key" ON "InspectionReportAnswer"("reportId", "key");

-- CreateIndex
CREATE INDEX "FactoryDevelopmentNotice_applicationId_idx" ON "FactoryDevelopmentNotice"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryDevelopmentNotice_applicationId_roundNo_key" ON "FactoryDevelopmentNotice"("applicationId", "roundNo");

-- CreateIndex
CREATE UNIQUE INDEX "SampleLetter_letterNo_key" ON "SampleLetter"("letterNo");

-- CreateIndex
CREATE INDEX "SampleLetter_applicationId_idx" ON "SampleLetter"("applicationId");

-- CreateIndex
CREATE INDEX "SampleLetter_labId_idx" ON "SampleLetter"("labId");

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgPost" ADD CONSTRAINT "OrgPost_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_orgPostId_fkey" FOREIGN KEY ("orgPostId") REFERENCES "OrgPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_orgPostId_fkey" FOREIGN KEY ("orgPostId") REFERENCES "OrgPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_actingOrgPostId_fkey" FOREIGN KEY ("actingOrgPostId") REFERENCES "OrgPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_presentAddressId_fkey" FOREIGN KEY ("presentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_permanentAddressId_fkey" FOREIGN KEY ("permanentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayScaleStep" ADD CONSTRAINT "PayScaleStep_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "PayScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseRentRule" ADD CONSTRAINT "HouseRentRule_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "PayScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttendance" ADD CONSTRAINT "DailyAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixation" ADD CONSTRAINT "SalaryFixation_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "PayScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixation" ADD CONSTRAINT "SalaryFixation_verdictId_fkey" FOREIGN KEY ("verdictId") REFERENCES "CaseVerdict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixation" ADD CONSTRAINT "SalaryFixation_baselineFixationId_fkey" FOREIGN KEY ("baselineFixationId") REFERENCES "SalaryFixation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixation" ADD CONSTRAINT "SalaryFixation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixationItem" ADD CONSTRAINT "SalaryFixationItem_fixationId_fkey" FOREIGN KEY ("fixationId") REFERENCES "SalaryFixation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryFixationItem" ADD CONSTRAINT "SalaryFixationItem_headId_fkey" FOREIGN KEY ("headId") REFERENCES "SalaryHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_bstiOfficeId_fkey" FOREIGN KEY ("bstiOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocument" ADD CONSTRAINT "OrganizationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeBankAccount" ADD CONSTRAINT "OfficeBankAccount_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeBankAccount" ADD CONSTRAINT "OfficeBankAccount_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCase" ADD CONSTRAINT "EmployeeCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVerdict" ADD CONSTRAINT "CaseVerdict_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "EmployeeCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerdictClause" ADD CONSTRAINT "VerdictClause_headId_fkey" FOREIGN KEY ("headId") REFERENCES "SalaryHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerdictClause" ADD CONSTRAINT "VerdictClause_verdictId_fkey" FOREIGN KEY ("verdictId") REFERENCES "CaseVerdict"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryArrear" ADD CONSTRAINT "SalaryArrear_paidInProcessId_fkey" FOREIGN KEY ("paidInProcessId") REFERENCES "SalaryProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryArrear" ADD CONSTRAINT "SalaryArrear_verdictId_fkey" FOREIGN KEY ("verdictId") REFERENCES "CaseVerdict"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryArrear" ADD CONSTRAINT "SalaryArrear_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryProcess" ADD CONSTRAINT "SalaryProcess_fixationId_fkey" FOREIGN KEY ("fixationId") REFERENCES "SalaryFixation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryProcess" ADD CONSTRAINT "SalaryProcess_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkHistory" ADD CONSTRAINT "WorkHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForeignTraining" ADD CONSTRAINT "ForeignTraining_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAdvice" ADD CONSTRAINT "BankAdvice_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdCardBatch" ADD CONSTRAINT "IdCardBatch_directorGeneralId_fkey" FOREIGN KEY ("directorGeneralId") REFERENCES "DirectorGeneral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdCard" ADD CONSTRAINT "IdCard_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdCard" ADD CONSTRAINT "IdCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdCardBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spouse" ADD CONSTRAINT "Spouse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curricular" ADD CONSTRAINT "Curricular_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryAction" ADD CONSTRAINT "DisciplinaryAction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bds" ADD CONSTRAINT "Bds_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "BdsDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bds" ADD CONSTRAINT "Bds_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Bds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_attachToApplicationId_fkey" FOREIGN KEY ("attachToApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdsPurchase" ADD CONSTRAINT "BdsPurchase_bdsId_fkey" FOREIGN KEY ("bdsId") REFERENCES "Bds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdsPurchase" ADD CONSTRAINT "BdsPurchase_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdsPurchase" ADD CONSTRAINT "BdsPurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdsPurchase" ADD CONSTRAINT "BdsPurchase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdsPurchase" ADD CONSTRAINT "BdsPurchase_consumedByApplicationId_fkey" FOREIGN KEY ("consumedByApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_bstiOfficeId_fkey" FOREIGN KEY ("bstiOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_applicationFeePaymentId_fkey" FOREIGN KEY ("applicationFeePaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_consentAcceptedBy_fkey" FOREIGN KEY ("consentAcceptedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_holderEmployeeId_fkey" FOREIGN KEY ("holderEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvent" ADD CONSTRAINT "ApplicationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_bdsId_fkey" FOREIGN KEY ("bdsId") REFERENCES "Bds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStandard" ADD CONSTRAINT "ProductStandard_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStandard" ADD CONSTRAINT "ProductStandard_bdsId_fkey" FOREIGN KEY ("bdsId") REFERENCES "Bds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SizeUnit" ADD CONSTRAINT "SizeUnit_sizeTypeId_fkey" FOREIGN KEY ("sizeTypeId") REFERENCES "SizeType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSku" ADD CONSTRAINT "ApplicationSku_applicationSubProductId_fkey" FOREIGN KEY ("applicationSubProductId") REFERENCES "ApplicationSubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSku" ADD CONSTRAINT "ApplicationSku_declaredByEmployeeId_fkey" FOREIGN KEY ("declaredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSku" ADD CONSTRAINT "ApplicationSku_notInProductionByEmployeeId_fkey" FOREIGN KEY ("notInProductionByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSku" ADD CONSTRAINT "ApplicationSku_sizeTypeId_fkey" FOREIGN KEY ("sizeTypeId") REFERENCES "SizeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSku" ADD CONSTRAINT "ApplicationSku_sizeUnitId_fkey" FOREIGN KEY ("sizeUnitId") REFERENCES "SizeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationProduction" ADD CONSTRAINT "ApplicationProduction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationProduction" ADD CONSTRAINT "ApplicationProduction_capacityUnitId_fkey" FOREIGN KEY ("capacityUnitId") REFERENCES "SizeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMovement" ADD CONSTRAINT "ApplicationMovement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMovement" ADD CONSTRAINT "ApplicationMovement_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMovement" ADD CONSTRAINT "ApplicationMovement_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationMovement" ADD CONSTRAINT "ApplicationMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestMethod" ADD CONSTRAINT "TestMethod_bdsId_fkey" FOREIGN KEY ("bdsId") REFERENCES "Bds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubProduct" ADD CONSTRAINT "SubProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubProduct" ADD CONSTRAINT "SubProduct_bdsId_fkey" FOREIGN KEY ("bdsId") REFERENCES "Bds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubProductPackageFee" ADD CONSTRAINT "SubProductPackageFee_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestParameter" ADD CONSTRAINT "TestParameter_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "TestMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSubParameter" ADD CONSTRAINT "TestSubParameter_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSubParameter" ADD CONSTRAINT "TestSubParameter_refBdsId_fkey" FOREIGN KEY ("refBdsId") REFERENCES "Bds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubProductScope" ADD CONSTRAINT "OfficeSubProductScope_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubProductScope" ADD CONSTRAINT "OfficeSubProductScope_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSubProductScope" ADD CONSTRAINT "OfficeSubProductScope_declaredByEmployeeId_fkey" FOREIGN KEY ("declaredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterCapability" ADD CONSTRAINT "ParameterCapability_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterCapability" ADD CONSTRAINT "ParameterCapability_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterCapability" ADD CONSTRAINT "ParameterCapability_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterCapability" ADD CONSTRAINT "ParameterCapability_declaredByEmployeeId_fkey" FOREIGN KEY ("declaredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingPreference" ADD CONSTRAINT "RoutingPreference_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingPreference" ADD CONSTRAINT "RoutingPreference_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingPreference" ADD CONSTRAINT "RoutingPreference_toOfficeId_fkey" FOREIGN KEY ("toOfficeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSampleRequirement" ADD CONSTRAINT "OfficeSampleRequirement_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSampleRequirement" ADD CONSTRAINT "OfficeSampleRequirement_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeSampleRequirement" ADD CONSTRAINT "OfficeSampleRequirement_agreedByEmployeeId_fkey" FOREIGN KEY ("agreedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubProduct" ADD CONSTRAINT "ApplicationSubProduct_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubProduct" ADD CONSTRAINT "ApplicationSubProduct_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubProduct" ADD CONSTRAINT "ApplicationSubProduct_declaredByEmployeeId_fkey" FOREIGN KEY ("declaredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubProduct" ADD CONSTRAINT "ApplicationSubProduct_notInProductionByEmployeeId_fkey" FOREIGN KEY ("notInProductionByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationParameterDestination" ADD CONSTRAINT "ApplicationParameterDestination_applicationSubProductId_fkey" FOREIGN KEY ("applicationSubProductId") REFERENCES "ApplicationSubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationParameterDestination" ADD CONSTRAINT "ApplicationParameterDestination_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationParameterDestination" ADD CONSTRAINT "ApplicationParameterDestination_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationParameterDestination" ADD CONSTRAINT "ApplicationParameterDestination_chosenByEmployeeId_fkey" FOREIGN KEY ("chosenByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequirement" ADD CONSTRAINT "SampleRequirement_applicationSubProductId_fkey" FOREIGN KEY ("applicationSubProductId") REFERENCES "ApplicationSubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequirement" ADD CONSTRAINT "SampleRequirement_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRequirement" ADD CONSTRAINT "SampleRequirement_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_packedByEmployeeId_fkey" FOREIGN KEY ("packedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignment" ADD CONSTRAINT "Consignment_openedByEmployeeId_fkey" FOREIGN KEY ("openedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_labTestOrderId_fkey" FOREIGN KEY ("labTestOrderId") REFERENCES "LabTestOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRegistration" ADD CONSTRAINT "SampleRegistration_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRegistration" ADD CONSTRAINT "SampleRegistration_applicationSkuId_fkey" FOREIGN KEY ("applicationSkuId") REFERENCES "ApplicationSku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRegistration" ADD CONSTRAINT "SampleRegistration_applicationSubProductId_fkey" FOREIGN KEY ("applicationSubProductId") REFERENCES "ApplicationSubProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRegistration" ADD CONSTRAINT "SampleRegistration_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleRegistration" ADD CONSTRAINT "SampleRegistration_sealedByEmployeeId_fkey" FOREIGN KEY ("sealedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_subProductId_fkey" FOREIGN KEY ("subProductId") REFERENCES "SubProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_holderEmployeeId_fkey" FOREIGN KEY ("holderEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderItem" ADD CONSTRAINT "LabTestOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabTestOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrderItem" ADD CONSTRAINT "LabTestOrderItem_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "TestParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabTestOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_subParameterId_fkey" FOREIGN KEY ("subParameterId") REFERENCES "TestSubParameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_enteredByEmployeeId_fkey" FOREIGN KEY ("enteredByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reidentification" ADD CONSTRAINT "Reidentification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortfallRound" ADD CONSTRAINT "ShortfallRound_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortfallRound" ADD CONSTRAINT "ShortfallRound_raisedByEmployeeId_fkey" FOREIGN KEY ("raisedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortfallRound" ADD CONSTRAINT "ShortfallRound_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortfallItem" ADD CONSTRAINT "ShortfallItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ShortfallRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPlan" ADD CONSTRAINT "InspectionPlan_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPlan" ADD CONSTRAINT "InspectionPlan_proposedByEmployeeId_fkey" FOREIGN KEY ("proposedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPlan" ADD CONSTRAINT "InspectionPlan_approvedByEmployeeId_fkey" FOREIGN KEY ("approvedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTeamMember" ADD CONSTRAINT "InspectionTeamMember_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InspectionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTeamMember" ADD CONSTRAINT "InspectionTeamMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_preparedByEmployeeId_fkey" FOREIGN KEY ("preparedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_foundCapacityUnitId_fkey" FOREIGN KEY ("foundCapacityUnitId") REFERENCES "SizeUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReport" ADD CONSTRAINT "InspectionReport_approvedByEmployeeId_fkey" FOREIGN KEY ("approvedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionConditionCheck" ADD CONSTRAINT "InspectionConditionCheck_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InspectionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionMarkingCheck" ADD CONSTRAINT "InspectionMarkingCheck_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InspectionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReportAnswer" ADD CONSTRAINT "InspectionReportAnswer_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "InspectionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryDevelopmentNotice" ADD CONSTRAINT "FactoryDevelopmentNotice_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryDevelopmentNotice" ADD CONSTRAINT "FactoryDevelopmentNotice_raisedByEmployeeId_fkey" FOREIGN KEY ("raisedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryDevelopmentNotice" ADD CONSTRAINT "FactoryDevelopmentNotice_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLetter" ADD CONSTRAINT "SampleLetter_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLetter" ADD CONSTRAINT "SampleLetter_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLetter" ADD CONSTRAINT "SampleLetter_addressedToEmployeeId_fkey" FOREIGN KEY ("addressedToEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLetter" ADD CONSTRAINT "SampleLetter_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleLetter" ADD CONSTRAINT "SampleLetter_issuedByEmployeeId_fkey" FOREIGN KEY ("issuedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

