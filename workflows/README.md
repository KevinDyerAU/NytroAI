# n8n Workflows

This directory contains exported n8n workflows from the NytroAI automation system.

## Overview

These workflows represent the non-archived automation processes used in the NytroAI project. Each workflow is stored as a JSON file that can be imported directly into n8n.

## Statistics

- **Total Workflows**: 38
- **Active Workflows**: 26
- **Inactive Workflows**: 12

## File Naming Convention

Files are named using the pattern: `{workflow_id}_{workflow_name}.json`

- **workflow_id**: The unique identifier from n8n
- **workflow_name**: A sanitized version of the workflow's display name

---

## Workflow Categories

### 1. Validation Workflows (14)

AI-powered validation workflows for educational content, assessments, and learning materials.

| Workflow Name | Status | Nodes | Description |
|--------------|--------|-------|-------------|
| SimpleACValidateUnit | 🟢 Active | 14 | Validates Assessment Conditions (AC) against unit requirements |
| SimpleAIValidateUnit | 🟢 Active | 13 | AI-powered validation of unit content and structure |
| AI Smart Question Generator - Validation Context | 🟢 Active | 9 | Generates contextually relevant validation questions using AI |
| StudentValidation | ⚪ Inactive | 10 | Validates student submissions and assessments |
| SimpleE_PCValidateLG | 🟢 Active | 12 | Validates Elements, Performance Criteria against Learning Guides |
| PreMarkingValidation | ⚪ Inactive | 10 | Pre-marking validation for assessment submissions |
| AI Validation Flow - Enhanced (Individual + Session Context) | 🟢 Active | 18 | Advanced validation with individual and session context awareness |
| SimplePEValidateUnit | 🟢 Active | 11 | Validates Performance Evidence against unit requirements |
| SimpleKEValidateLG | 🟢 Active | 11 | Validates Knowledge Evidence against Learning Guides |
| SimpleFSValidateUnit | 🟢 Active | 11 | Validates Foundation Skills against unit requirements |
| SimpleE_PCValidateUnit | 🟢 Active | 13 | Validates Elements and Performance Criteria against units |
| AI Individual Requirement Revalidation - Evidence-Based Assessment | 🟢 Active | 10 | Evidence-based revalidation of individual requirements |
| SimplePEValidateLG | 🟢 Active | 11 | Validates Performance Evidence against Learning Guides |
| SimpleKEValidateUnit | 🟢 Active | 11 | Validates Knowledge Evidence against unit requirements |

### 2. Extraction Workflows (6)

Automated data extraction and web scraping workflows for gathering educational content.

| Workflow Name | Status | Nodes | Description |
|--------------|--------|-------|-------------|
| UOCExtractCatchSaveSections | ⚪ Inactive | 6 | Extracts and saves sections from Unit of Competency documents |
| SmartPExtractAgent_v4 | 🟢 Active | 7 | Smart extraction agent for Performance Evidence (v4) |
| UOCScrapeFull | 🟢 Active | 25 | Full scraping workflow for Unit of Competency data |
| UOCScrape | 🟢 Active | 7 | Basic scraping workflow for Unit of Competency data |
| SmartKExtractAgent_v4 | 🟢 Active | 7 | Smart extraction agent for Knowledge Evidence (v4) |
| SimplePremarkQuestionExtractAgent | ⚪ Inactive | 7 | Extracts premarking questions from documents |

### 3. Chat & AI Agent Workflows (7)

Interactive AI agents for document Q&A, assistance, and intelligent automation.

| Workflow Name | Status | Nodes | Description |
|--------------|--------|-------|-------------|
| SmartE_PCxtractAgent_v4 | 🟢 Active | 8 | Smart extraction agent for Elements and Performance Criteria (v4) |
| AI Chat Agent - Document QA (No History, Direct Documents) | 🟢 Active | 8 | Stateless document Q&A chat agent with direct document access |
| SmartFSxtractAgent_v4 | 🟢 Active | 11 | Smart extraction agent for Foundation Skills (v4) |
| Personal AI Assistant with Telegram Voice and Text | ⚪ Inactive | 15 | Telegram-based AI assistant with voice and text support |
| n8nDeveloperAgent | 🟢 Active | 17 | AI agent for n8n workflow development assistance |
| SimpleAIChat | 🟢 Active | 6 | Simple AI chat interface for general queries |
| PGVectorAgent | ⚪ Inactive | 5 | PostgreSQL vector database agent for semantic search |

### 4. Document Processing Workflows (5)

Workflows for processing, embedding, and upserting documents into vector databases.

| Workflow Name | Status | Nodes | Description |
|--------------|--------|-------|-------------|
| SmartUnstructuredUpsert v2 | ⚪ Inactive | 22 | Advanced document processing and upserting (v2) |
| SmartUnstructuredUpsertPMStud | ⚪ Inactive | 21 | Document upserting for Pre-Marking Student data |
| GeminiUnstructuredPinecone | ⚪ Inactive | 22 | Gemini-powered document processing with Pinecone vector DB |
| DocumentProcessingFlow_Gemini_V1 | 🟢 Active | 18 | Gemini-based document processing pipeline (v1) |
| SimpleDocProcessEmbed | 🟢 Active | 19 | Simple document processing and embedding workflow |

### 5. Integration & Other Workflows (6)

Integration workflows for external services and utility automation.

| Workflow Name | Status | Nodes | Description |
|--------------|--------|-------|-------------|
| RTOCatch | 🟢 Active | 5 | Registered Training Organization (RTO) data capture workflow |
| OpenRouter Deep Test | ⚪ Inactive | 3 | Testing workflow for OpenRouter API integration |
| QualificationBrowseAI | 🟢 Active | 24 | AI-powered browsing and extraction of qualification data |
| TwilioSheet | 🟢 Active | 6 | Twilio SMS integration with spreadsheet logging |
| QualificationUnitOfCompetency-Legacy | ⚪ Inactive | 3 | Legacy workflow for qualification and UOC management |
| GoogleFileFlow | ⚪ Inactive | 21 | Google Drive file processing and management workflow |

---

## Usage

To import a workflow into n8n:

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select the desired JSON file from this directory
4. Configure any required credentials and settings
5. Activate the workflow as needed

## Key Features

### Validation System
The validation workflows form a comprehensive system for verifying educational content against Australian training standards, including:
- **Units of Competency (UOC)**: Core competency validation
- **Learning Guides (LG)**: Educational material validation
- **Assessment Components**: AC, PE, KE, FS validation
- **AI-Enhanced Validation**: Context-aware intelligent validation

### Extraction System
Smart extraction agents (v4 series) use AI to intelligently extract and structure data from various sources, with specialized agents for different content types.

### AI Integration
Multiple workflows leverage AI models (including Gemini) for:
- Document understanding and Q&A
- Content generation and validation
- Intelligent data extraction
- Development assistance

## Technical Notes

- **Credentials Required**: Most workflows require API credentials for services like OpenAI, Gemini, Pinecone, Supabase, etc.
- **Node Dependencies**: Some workflows use community nodes that may need to be installed separately
- **Environment Variables**: Check individual workflows for required environment variables
- **Active Status**: Active workflows are currently running in production; inactive workflows are available but not currently deployed

## Maintenance

- **Last Updated**: January 19, 2026
- **Source**: n8n instance (non-archived workflows only)
- **Version Control**: Workflows are version-controlled in this repository

## Support

For questions or issues with specific workflows, refer to the n8n documentation or contact the NytroAI development team.
