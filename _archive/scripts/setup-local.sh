#!/bin/bash

# ================================================================
# Local Development Setup Script
# ================================================================
# This script automates the setup of your local development environment
# Run this script once to get started with local development

set -e  # Exit on any error

echo "🚀 Setting up Perf Spotlight Portal - Local Development Environment"
echo "================================================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo "✅ npm: $NPM_VERSION"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/"
    exit 1
fi
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again"
    exit 1
fi
DOCKER_VERSION=$(docker --version)
echo "✅ Docker: $DOCKER_VERSION"

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI is not installed. Installing now..."
    npm install -g supabase
    echo "✅ Supabase CLI installed"
else
    SUPABASE_VERSION=$(supabase --version)
    echo "✅ Supabase CLI: $SUPABASE_VERSION"
fi

echo ""
echo "================================================================"
echo "📦 Installing dependencies..."
echo "================================================================"
echo ""

npm install

echo ""
echo "✅ Dependencies installed"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "================================================================"
    echo "⚙️  Creating .env.local from example..."
    echo "================================================================"
    echo ""

    cp .env.local.example .env.local
    echo "✅ Created .env.local"
    echo "⚠️  Please edit .env.local and add your Email Bison API key (optional for local dev)"
    echo ""
else
    echo "✅ .env.local already exists"
    echo ""
fi

# Check if Supabase is running
echo "================================================================"
echo "🐘 Starting local Supabase..."
echo "================================================================"
echo ""

if supabase status &> /dev/null; then
    echo "✅ Supabase is already running"
else
    echo "Starting Supabase (this may take 2-5 minutes on first run)..."
    supabase start
fi

echo ""
echo "================================================================"
echo "📊 Applying database migrations..."
echo "================================================================"
echo ""

supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"

echo ""
echo "================================================================"
echo "✅ Setup Complete!"
echo "================================================================"
echo ""
echo "Your local development environment is ready!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Start the development server:"
echo "   npm run dev"
echo ""
echo "2. Open your browser to:"
echo "   http://localhost:8080"
echo ""
echo "3. Open Supabase Studio (database UI):"
echo "   http://localhost:54323"
echo ""
echo "4. (Optional) Add test data in Supabase Studio"
echo ""
echo "================================================================"
echo "📚 Documentation:"
echo "================================================================"
echo ""
echo "- Local Development Guide: LOCAL_DEVELOPMENT_GUIDE.md"
echo "- System Architecture: SYSTEM_ARCHITECTURE.md"
echo ""
echo "================================================================"
echo "🎉 Happy coding!"
echo "================================================================"
