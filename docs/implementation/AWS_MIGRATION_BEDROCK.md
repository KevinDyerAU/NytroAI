# AWS Fargate Migration & Amazon Bedrock Integration Guide

**Author**: Manus AI
**Date**: December 24, 2025

## 1. Introduction

This document outlines the technical implementation plan for migrating n8n hosting to **AWS Fargate** for Australian data sovereignty and integrating Amazon Bedrock as a Large Language Model (LLM) provider. This guide is applicable to both the NytroAI and DygitalConnections projects.

## 2. AWS Fargate Migration for n8n Hosting

Migrating the self-hosted n8n instance to AWS Fargate provides enhanced scalability, reliability, and data sovereignty by leveraging the AWS Sydney (ap-southeast-2) region.

### 2.1. Recommended Architecture

A containerized deployment using **AWS Fargate** is the recommended approach. Fargate is a serverless compute engine for containers that removes the need to provision and manage servers, providing a fully managed, scalable, and cost-effective solution for running the n8n Docker container.

| Component | Service | Configuration |
|---|---|---|
| **Container Compute** | AWS Fargate | Serverless container execution |
| **Container Registry** | Amazon ECR | Stores the n8n Docker image |
| **Database** | Amazon RDS for PostgreSQL | Multi-AZ for high availability |
| **Load Balancing** | Application Load Balancer (ALB) | Manages traffic to the n8n container |
| **Security** | AWS WAF & Security Groups | Protects against common web exploits |

### 2.2. Why Fargate over EC2-based ECS?

| Feature | AWS Fargate | EC2-based ECS |
|---------|-------------|---------------|
| **Server Management** | None (serverless) | Requires EC2 instance management |
| **Scaling** | Automatic, per-task | Requires cluster capacity planning |
| **Cost Model** | Pay per task (vCPU + memory) | Pay for EC2 instances (always on) |
| **Patching** | AWS-managed | Customer-managed |
| **Best For** | Variable workloads, simplicity | Predictable, high-volume workloads |

### 2.3. Implementation Steps

1.  **Create an ECR Repository**: Create a private ECR repository to store the n8n Docker image.
2.  **Build and Push Docker Image**: Build the n8n Docker image and push it to the ECR repository.
3.  **Set up RDS for PostgreSQL**: Provision a PostgreSQL instance on RDS. Ensure it is in a private subnet for security.
4.  **Create Fargate Task Definition**:
    *   Define the n8n container image, CPU/memory allocation, and environment variables.
    *   Configure networking mode as `awsvpc` for Fargate compatibility.
    *   Set up logging to CloudWatch Logs.
5.  **Create Fargate Service**: Create a Fargate service to run and maintain the desired number of n8n tasks. Configure it to use the ALB for load balancing.
6.  **Deploy and Test**: Deploy the service and test the n8n instance.

### 2.4. Fargate Task Definition Example

```json
{
  "family": "n8n-fargate",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/n8nTaskRole",
  "containerDefinitions": [
    {
      "name": "n8n",
      "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/n8n:latest",
      "portMappings": [
        {
          "containerPort": 5678,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "DB_TYPE", "value": "postgresdb"},
        {"name": "DB_POSTGRESDB_HOST", "value": "your-rds-endpoint"},
        {"name": "DB_POSTGRESDB_DATABASE", "value": "n8n"},
        {"name": "N8N_ENCRYPTION_KEY", "value": "your-encryption-key"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/n8n-fargate",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "n8n"
        }
      }
    }
  ]
}
```

## 3. Amazon Bedrock Integration

Integrating Amazon Bedrock allows for the use of various foundation models while ensuring data remains within the AWS ecosystem, which is critical for data sovereignty.

### 3.1. Bedrock Model Selection

Amazon Bedrock provides access to a wide range of models. For the NytroAI and DygitalConnections projects, the following models are recommended:

| Provider | Model | Use Case |
|---|---|---|
| **Anthropic** | Claude 3 Sonnet | Balanced performance for general tasks |
| **Anthropic** | Claude 3 Haiku | High-speed, cost-effective for simple tasks |
| **Amazon** | Titan Text G1 - Express | General-purpose text generation |

### 3.2. Implementation in n8n on Fargate

n8n has a native **Amazon Bedrock** node that simplifies integration. The implementation involves:

1.  **IAM Role and Permissions**: Create an IAM role with permissions to invoke Bedrock models. Attach this role to the Fargate task running n8n via `taskRoleArn`.
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

- **AWS Region**: All AWS services (Fargate, ECR, RDS, Bedrock) **must** be deployed in the `ap-southeast-2` (Sydney) region.
- **Data in Transit**: Use TLS 1.2 or higher for all communication between services.
- **Data at Rest**: Enable encryption at rest for RDS and any other data stores.
- **VPC Configuration**: Deploy Fargate tasks in private subnets with NAT Gateway for outbound internet access.

## 5. Cost Estimation (AWS Fargate)

| Resource | Configuration | Estimated Monthly Cost |
|----------|---------------|------------------------|
| **Fargate** | 1 vCPU, 2GB RAM, 24/7 | ~$30-40 |
| **ALB** | Application Load Balancer | ~$20 |
| **RDS PostgreSQL** | db.t3.micro, Multi-AZ | ~$30 |
| **ECR** | Image storage | ~$1 |
| **CloudWatch Logs** | Log storage | ~$5 |
| **Bedrock** | Usage-based | ~$50 (variable) |
| **Total** | | **~$135-145/month** |

## 6. Conclusion

This implementation plan provides a clear path to achieving Australian data sovereignty for the NytroAI and DygitalConnections projects. By migrating n8n to AWS Fargate and integrating Amazon Bedrock, the projects will benefit from enhanced security, scalability, serverless operations, and compliance.
