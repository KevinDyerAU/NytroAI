# n8n Workflows

This directory contains exported n8n workflows from the NytroAI automation system.

## Overview

These workflows represent the non-archived automation processes used in the NytroAI project. Each workflow is stored as a JSON file that can be imported directly into n8n.

## File Naming Convention

Files are named using the pattern: `{workflow_id}_{workflow_name}.json`

- **workflow_id**: The unique identifier from n8n
- **workflow_name**: A sanitized version of the workflow's display name

## Workflow Categories

The workflows in this directory cover various automation tasks including:

- **Validation Workflows**: AI-powered validation of units, learning guides, and assessments
- **Extraction Workflows**: Automated data extraction from various sources
- **Chat Agents**: AI chat interfaces for document Q&A and assistance
- **Document Processing**: Workflows for processing and embedding documents
- **Integration Workflows**: Connections with external services (Twilio, Google, etc.)

## Total Workflows

This directory contains **38 non-archived workflows** extracted from n8n.

## Usage

To import a workflow into n8n:

1. Open your n8n instance
2. Go to **Workflows** → **Import from File**
3. Select the desired JSON file from this directory
4. Configure any required credentials and settings
5. Activate the workflow as needed

## Maintenance

These workflows were extracted on **January 19, 2026**. For the most up-to-date versions, please refer to the live n8n instance.

## Notes

- Workflows may contain references to credentials that need to be configured in your n8n instance
- Some workflows may have dependencies on specific n8n nodes or community packages
- Review and test workflows in a development environment before deploying to production
