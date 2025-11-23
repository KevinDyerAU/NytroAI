#!/bin/bash

# ============================================================================
# NytroAI Automated Setup Script
# ============================================================================
# This script automates the setup process for NytroAI
# Run with: bash scripts/setup.sh
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================

print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js is installed: $NODE_VERSION"
else
    print_error "Node.js is not installed"
    print_info "Please install Node.js from https://nodejs.org (LTS version recommended)"
    exit 1
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm is installed: $NPM_VERSION"
else
    print_error "npm is not installed"
    exit 1
fi

# Check git
if command_exists git; then
    GIT_VERSION=$(git --version)
    print_success "Git is installed: $GIT_VERSION"
else
    print_error "Git is not installed"
    print_info "Please install Git from https://git-scm.com"
    exit 1
fi

# ============================================================================
# STEP 2: Install Dependencies
# ============================================================================

print_header "Step 2: Installing Dependencies"

print_info "Installing Node.js dependencies..."
npm install

print_success "Dependencies installed successfully"

# ============================================================================
# STEP 3: Install Supabase CLI
# ============================================================================

print_header "Step 3: Installing Supabase CLI"

if command_exists supabase; then
    SUPABASE_VERSION=$(supabase --version)
    print_success "Supabase CLI is already installed: $SUPABASE_VERSION"
else
    print_info "Installing Supabase CLI..."
    npm install -g supabase
    print_success "Supabase CLI installed successfully"
fi

# ============================================================================
# STEP 4: Setup Environment Variables
# ============================================================================

print_header "Step 4: Setting Up Environment Variables"

if [ -f ".env.local" ]; then
    print_warning ".env.local already exists. Skipping..."
else
    print_info "Creating .env.local file..."
    
    # Prompt for Supabase credentials
    echo ""
    print_info "Please enter your Supabase credentials:"
    echo -e "${YELLOW}(You can find these in your Supabase project settings)${NC}"
    echo ""
    
    read -p "Supabase URL: " SUPABASE_URL
    read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
    
    echo ""
    print_info "Please enter your Google AI Studio API key:"
    echo -e "${YELLOW}(Get one from https://aistudio.google.com/app/apikey)${NC}"
    echo ""
    
    read -p "Gemini API Key: " GEMINI_API_KEY
    
    # Create .env.local file
    cat > .env.local << EOF
# Supabase Configuration
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Google AI Studio Configuration
VITE_GEMINI_API_KEY=$GEMINI_API_KEY
EOF
    
    print_success ".env.local file created successfully"
fi

# ============================================================================
# STEP 5: Link Supabase Project
# ============================================================================

print_header "Step 5: Linking Supabase Project"

if [ -f ".supabase/config.toml" ]; then
    print_warning "Supabase project already linked. Skipping..."
else
    print_info "Linking to your Supabase project..."
    echo ""
    print_info "Please enter your Supabase project reference ID:"
    echo -e "${YELLOW}(Find this in Settings → General → Reference ID)${NC}"
    echo ""
    
    read -p "Project Reference ID: " PROJECT_REF
    
    supabase link --project-ref "$PROJECT_REF"
    
    print_success "Supabase project linked successfully"
fi

# ============================================================================
# STEP 6: Apply Database Migrations
# ============================================================================

print_header "Step 6: Applying Database Migrations"

print_info "Applying database migrations..."
supabase db push

print_success "Database migrations applied successfully"

# ============================================================================
# STEP 7: Deploy Edge Functions
# ============================================================================

print_header "Step 7: Deploying Edge Functions"

print_info "Deploying edge functions..."

# List of edge functions to deploy
FUNCTIONS=(
    "trigger-validation"
    "validate-assessment"
    "regenerate-smart-questions"
    "upload-document"
    "query-document"
    "create-validation-record"
    "get-dashboard-metrics"
)

for func in "${FUNCTIONS[@]}"; do
    print_info "Deploying $func..."
    supabase functions deploy "$func"
    print_success "$func deployed"
done

print_success "All edge functions deployed successfully"

# ============================================================================
# STEP 8: Verify Setup
# ============================================================================

print_header "Step 8: Verifying Setup"

# Check if .env.local has all required variables
if grep -q "VITE_SUPABASE_URL" .env.local && \
   grep -q "VITE_SUPABASE_ANON_KEY" .env.local && \
   grep -q "VITE_GEMINI_API_KEY" .env.local; then
    print_success "Environment variables configured"
else
    print_error "Environment variables incomplete"
fi

# Check if migrations were applied
if supabase db diff --schema public | grep -q "No schema changes detected"; then
    print_success "Database migrations applied"
else
    print_warning "Database may have pending changes"
fi

# ============================================================================
# COMPLETION
# ============================================================================

print_header "Setup Complete! 🎉"

echo ""
print_success "NytroAI is ready to use!"
echo ""
print_info "Next steps:"
echo "  1. Start the development server: ${GREEN}npm run dev${NC}"
echo "  2. Open your browser to: ${GREEN}http://localhost:5173${NC}"
echo "  3. Create an account and start validating!"
echo ""
print_info "Need help? Check out:"
echo "  • User Guide: ${BLUE}docs/USER_GUIDE.md${NC}"
echo "  • FAQ: ${BLUE}docs/FAQ.md${NC}"
echo "  • Troubleshooting: ${BLUE}docs/TROUBLESHOOTING.md${NC}"
echo ""
print_info "Happy validating! 🚀"
echo ""
