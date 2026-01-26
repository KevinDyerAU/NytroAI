# Azure Workflow Update for GPT-4.1-mini

This document contains the changes needed to update the Azure provisioning workflow to support GPT-4.1-mini.

## Why This Requires Manual Update

GitHub Apps cannot modify workflow files without explicit `workflows` permission. You'll need to apply these changes manually or via the GitHub web interface.

## Changes Required

### File: `.github/workflows/provision-azure-infrastructure.yml`

#### 1. Add new input parameter (after `openai_sku` input, around line 42):

```yaml
      openai_model:
        description: 'OpenAI model to deploy (gpt-4o-mini or gpt-4.1-mini)'
        required: true
        default: 'gpt-4.1-mini'
        type: choice
        options:
          - gpt-4o-mini
          - gpt-4.1-mini
```

#### 2. Update the "Deploy GPT-4o-mini Model" step (around line 330):

Replace the step name and the model configuration section:

**Before:**
```yaml
      - name: 🚀 Deploy GPT-4o-mini Model
        id: gpt-deployment
        run: |
          set -e  # Exit on error
          
          echo "Deploying GPT-4o-mini model to Australia East..."
          
          DEPLOYMENT_NAME="gpt-4o-mini"
          MODEL_NAME="gpt-4o-mini"
          MODEL_VERSION="2024-07-18"
```

**After:**
```yaml
      - name: 🚀 Deploy OpenAI Model
        id: gpt-deployment
        run: |
          set -e  # Exit on error
          
          # Determine model configuration based on input
          SELECTED_MODEL="${{ github.event.inputs.openai_model }}"
          echo "Selected model: $SELECTED_MODEL"
          
          if [ "$SELECTED_MODEL" = "gpt-4.1-mini" ]; then
            DEPLOYMENT_NAME="gpt-4-1-mini"
            MODEL_NAME="gpt-4.1-mini"
            MODEL_VERSION="2025-04-14"
            echo "Deploying GPT-4.1-mini model (improved instruction following)..."
          else
            DEPLOYMENT_NAME="gpt-4o-mini"
            MODEL_NAME="gpt-4o-mini"
            MODEL_VERSION="2024-07-18"
            echo "Deploying GPT-4o-mini model..."
          fi
```

#### 3. Update deployment status messages

Replace references to "GPT-4o-mini" with `$MODEL_NAME` in the deployment step.

#### 4. Update summary output (around line 456):

**Before:**
```yaml
          echo "| GPT-4o-mini Deployment | \`${{ steps.gpt-deployment.outputs.deployment_name }}\` | - | ✅ |" >> $GITHUB_STEP_SUMMARY
```

**After:**
```yaml
          echo "| OpenAI Model Deployment | \`${{ steps.gpt-deployment.outputs.deployment_name }}\` (${{ steps.gpt-deployment.outputs.model_name }}) | ${{ env.OPENAI_LOCATION }} | ✅ |" >> $GITHUB_STEP_SUMMARY
```

## Steps to Deploy GPT-4.1-mini

1. **Apply the workflow changes** (manually or via GitHub web interface)

2. **Run the workflow** with these inputs:
   - Environment: `production` (or your target environment)
   - OpenAI Model: `gpt-4.1-mini`
   - OpenAI Location: Check Azure availability - try `eastus2` or `swedencentral` for Global Standard

3. **Update Supabase secrets** with the new deployment name:
   ```
   AZURE_OPENAI_DEPLOYMENT=gpt-4-1-mini
   ```

4. **Redeploy Edge Functions** to pick up the new default

## Model Comparison

| Model | Instruction Following | Context | Cost (per 1M tokens) |
|-------|----------------------|---------|---------------------|
| GPT-4o-mini | 29% | 128K | $0.15 / $0.60 |
| GPT-4.1-mini | 49% | 1M | $0.40 / $1.60 |
