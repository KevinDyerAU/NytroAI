#!/bin/bash

# Deploy get-requirements edge function
# This script deploys the fixed version with proper field mapping

echo "=========================================="
echo "Deploying get-requirements Edge Function"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/functions/get-requirements" ]; then
    echo "❌ Error: supabase/functions/get-requirements directory not found"
    echo "Please run this script from the NytroAI root directory"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Please install it: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "📦 Deploying get-requirements function..."
echo ""

supabase functions deploy get-requirements

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "=========================================="
    echo "What was deployed:"
    echo "=========================================="
    echo "✓ Fixed field mapping for all requirement types"
    echo "✓ Display types (user-friendly labels)"
    echo "✓ Element context for performance criteria"
    echo "✓ 5 hard-coded assessment conditions (AC1-AC5)"
    echo "✓ 8 hard-coded assessment instructions (AI1-AI8)"
    echo ""
    echo "=========================================="
    echo "Next Steps:"
    echo "=========================================="
    echo "1. Test the edge function:"
    echo "   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/get-requirements \\"
    echo "     -H 'Authorization: Bearer YOUR_KEY' \\"
    echo "     -d '{\"validation_detail_id\": \"741\"}'"
    echo ""
    echo "2. Verify the response includes:"
    echo "   - Non-empty 'text' fields"
    echo "   - 'display_type' fields"
    echo "   - 47 total requirements (including AC and AI)"
    echo ""
    echo "3. Run a validation workflow to test end-to-end"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Please check the error message above and try again."
    exit 1
fi
