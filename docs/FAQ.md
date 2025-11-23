# Frequently Asked Questions (FAQ)

## General Questions

### What is NytroAI?

NytroAI is an AI-powered tool that helps Australian RTOs validate their training assessments against unit requirements. It automatically checks if your assessments meet all the required knowledge, skills, and performance criteria.

### Who is NytroAI for?

NytroAI is designed for:
- **RTOs** - Registered Training Organisations
- **Assessment Developers** - Creating compliant assessments
- **Quality Managers** - Ensuring assessment quality
- **Trainers** - Validating their assessment tools

### Is NytroAI free?

NytroAI is open source and free to use. However, you'll need:
- A free Supabase account (database)
- A Google AI Studio API key (AI validation)

Both services have generous free tiers suitable for most users.

---

## Setup Questions

### What do I need to get started?

You need:
1. A computer with Node.js installed
2. A free Supabase account
3. A Google AI Studio API key
4. Your assessment documents (PDF format)

### How long does setup take?

About 5-10 minutes if you follow our [Quick Start Guide](./QUICK_START.md).

### Do I need coding experience?

No! The setup is straightforward with copy-paste commands. If you can follow a recipe, you can set up NytroAI.

### Can I use NytroAI without installing anything?

Currently, NytroAI needs to be installed locally. A hosted version may be available in the future.

---

## Usage Questions

### What file formats are supported?

Currently, NytroAI supports PDF documents. Your assessment must be in PDF format to be validated.

### How long does validation take?

Typically 1-3 minutes depending on:
- Assessment length
- Number of requirements
- API response time

### Can I validate multiple assessments at once?

Yes! You can upload multiple assessments and track them all in the dashboard.

### What units of competency are supported?

NytroAI works with any Australian unit of competency from training.gov.au. Just enter the unit code (e.g., BSBWHS332X) when uploading.

### Can I regenerate smart questions?

Yes! If you want different questions or want to provide additional context, you can regenerate smart questions from the results page.

---

## Results Questions

### What do the validation statuses mean?

- **Met** ✅ - The requirement is fully addressed in your assessment
- **Partial** ⚠️ - The requirement is partially addressed but needs improvement
- **Not Met** ❌ - The requirement is not addressed in your assessment

### What are "Smart Questions"?

Smart Questions are AI-generated assessment questions designed to address gaps in your assessment. They're specifically tailored to the requirements that are partially met or not met.

### Can I download the results?

Yes! You can export validation results as:
- PDF report
- Excel spreadsheet
- JSON data

### How accurate is the AI validation?

The AI is highly accurate but should be used as a tool to assist human judgment, not replace it. Always review the AI's reasoning and make your own professional assessment.

---

## Technical Questions

### What AI model does NytroAI use?

NytroAI uses Google's Gemini 2.0 Flash model, which is optimized for fast, accurate document analysis.

### Where is my data stored?

Your data is stored in your own Supabase database. You have full control over your data and can delete it anytime.

### Is my data secure?

Yes. Your data is:
- Stored in your private Supabase database
- Transmitted over HTTPS
- Not shared with third parties
- Under your control

### Can I use my own AI model?

Currently, NytroAI is designed to work with Google Gemini. Support for other models may be added in the future.

---

## Troubleshooting Questions

### Why is my validation stuck at "Processing"?

This usually means:
1. The edge functions aren't deployed - Check your Supabase dashboard
2. The database trigger isn't set up - Run `supabase db push`
3. API rate limits - Wait a few minutes and try again

### Why am I getting "Request timeout" errors?

This typically means:
1. Edge functions aren't deployed
2. API keys are incorrect
3. Network connectivity issues

Check our [Troubleshooting Guide](./TROUBLESHOOTING.md) for solutions.

### The dashboard shows no validations

Make sure:
1. You're logged in to the correct account
2. The validation completed successfully
3. Your browser cache is cleared

### Smart questions aren't generating

This could be because:
1. The requirement is already "Met" (no questions needed)
2. API rate limits
3. Insufficient context in the assessment

Try regenerating with additional context.

---

## Billing Questions

### How much does NytroAI cost?

NytroAI itself is free and open source. However, you'll use:

**Supabase (Database):**
- Free tier: 500MB database, 2GB bandwidth/month
- Usually sufficient for 100-200 validations/month

**Google AI Studio (AI):**
- Free tier: 15 requests/minute, 1 million tokens/day
- Usually sufficient for 50-100 validations/day

### What happens if I exceed free tier limits?

Supabase and Google AI Studio will notify you before charging. You can:
- Upgrade to a paid plan
- Wait for limits to reset (usually monthly)
- Optimize your usage

### Can I use NytroAI commercially?

Yes! NytroAI is MIT licensed, which allows commercial use. However, check the terms of service for Supabase and Google AI Studio.

---

## Feature Requests

### Can NytroAI validate other types of documents?

Currently, NytroAI is focused on training assessments. Other document types may be supported in the future.

### Will there be a mobile app?

Not currently planned, but the web interface is mobile-responsive.

### Can I suggest new features?

Absolutely! Please:
1. Check existing [GitHub Issues](https://github.com/KevinDyerAU/NytroAI/issues)
2. Create a new issue with your suggestion
3. Join the discussion in [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)

---

## Support

### Where can I get help?

- **Documentation:** Check our [User Guide](./USER_GUIDE.md)
- **Troubleshooting:** See [Troubleshooting Guide](./TROUBLESHOOTING.md)
- **Issues:** [GitHub Issues](https://github.com/KevinDyerAU/NytroAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)

### How can I contribute?

We welcome contributions! See our [Contributing Guide](../CONTRIBUTING.md) for details.

### Who maintains NytroAI?

NytroAI is maintained by Kevin Dyer and the open source community. See [Contributors](https://github.com/KevinDyerAU/NytroAI/graphs/contributors) for the full list.

---

**Still have questions?** [Ask in GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)
