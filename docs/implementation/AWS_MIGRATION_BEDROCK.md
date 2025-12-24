# AWS Migration & Amazon Bedrock Integration Guide

**Author**: Manus AI
**Date**: December 23, 2025

## 1. Introduction

This document outlines the technical implementation plan for migrating n8n hosting to Amazon Web Services (AWS) for Australian data sovereignty and integrating Amazon Bedrock as a Large Language Model (LLM) provider. This guide is applicable to both the NytroAI and DygitalConnections projects.

## 2. AWS Migration for n8n Hosting

Migrating the self-hosted n8n instance to AWS provides enhanced scalability, reliability, and data sovereignty by leveraging the AWS Sydney (ap-southeast-2) region.

### 2.1. Recommended Architecture

A containerized deployment using **Amazon Elastic Container Service (ECS)** with **Fargate** is the recommended approach. This provides a serverless, scalable, and cost-effective solution for running the n8n Docker container.

| Component | Service | Configuration |
|---|---|---|
| **Container Orchestration** | Amazon ECS | Fargate launch type |
| **Container Registry** | Amazon ECR | Stores the n8n Docker image |
| **Database** | Amazon RDS for PostgreSQL | Multi-AZ for high availability |
| **Load Balancing** | Application Load Balancer (ALB) | Manages traffic to the n8n container |
| **Security** | AWS WAF & Security Groups | Protects against common web exploits |

### 2.2. Implementation Steps

1.  **Create an ECR Repository**: Create a private ECR repository to store the n8n Docker image.
2.  **Build and Push Docker Image**: Build the n8n Docker image and push it to the ECR repository.
3.  **Set up RDS for PostgreSQL**: Provision a PostgreSQL instance on RDS. Ensure it is in a private subnet for security.
4.  **Create ECS Cluster and Task Definition**:
    *   Create an ECS cluster.
    *   Create a task definition that specifies the n8n container image, CPU/memory allocation, and environment variables.
5.  **Configure ECS Service**: Create an ECS service to run and maintain the desired number of n8n tasks. Configure it to use the ALB for load balancing.
6.  **Deploy and Test**: Deploy the service and test the n8n instance.

## 3. Amazon Bedrock Integration

Integrating Amazon Bedrock allows for the use of various foundation models while ensuring data remains within the AWS ecosystem, which is critical for data sovereignty.

### 3.1. Bedrock Model Selection

Amazon Bedrock provides access to a wide range of models. For the NytroAI and DygitalConnections projects, the following models are recommended:

| Provider | Model | Use Case |
|---|---|---|
| **Anthropic** | Claude 3 Sonnet | Balanced performance for general tasks |
| **Anthropic** | Claude 3 Haiku | High-speed, cost-effective for simple tasks |
| **Amazon** | Titan Text G1 - Express | General-purpose text generation |

### 3.2. Implementation in n8n

n8n has a native **Amazon Bedrock** node that simplifies integration. The implementation involves:

1.  **IAM Role and Permissions**: Create an IAM role with permissions to invoke Bedrock models. Attach this role to the ECS task running n8n.
2.  **Configure Bedrock Node**: In the n8n workflow, replace the existing LLM node (e.g., OpenAI, Gemini) with the Bedrock node.
3.  **Select Model**: Choose the desired model from the Bedrock node's dropdown menu.
4.  **Update Prompts**: Adjust prompts as necessary to optimize for the selected Bedrock model.

### 3.3. Code Example (n8n Bedrock Node)

```json
{
  "parameters": {
    "model": "anthropic.claude-3-sonnet-20240229-v1:0",
    "prompt": "={{ $json.prompt }}",
    "options": {
      "max_tokens_to_sample": 4096,
      "temperature": 0.3
    }
  },
  "id": "bedrock-llm",
  "name": "Amazon Bedrock",
  "type": "n8n-nodes-base.bedrock",
  "typeVersion": 1,
  "position": [880, 300]
}
```

## 4. Data Sovereignty Considerations

- **AWS Region**: All AWS services (ECS, ECR, RDS, Bedrock) **must** be deployed in the `ap-southeast-2` (Sydney) region.
- **Data in Transit**: Use TLS 1.2 or higher for all communication between services.
- **Data at Rest**: Enable encryption at rest for RDS and any other data stores.

## 5. Conclusion

This implementation plan provides a clear path to achieving Australian data sovereignty for the NytroAI and DygitalConnections projects. By migrating n8n to AWS and integrating Amazon Bedrock, the projects will benefit from enhanced security, scalability, and compliance.
