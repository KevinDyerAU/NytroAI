<div align="center">

<img width="1200" height="475" alt="NytroAI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# NytroAI

**Validate Training Assessments with AI in Minutes**

[![Built with Figma](https://img.shields.io/badge/Designed%20in-Figma-F24E1E?logo=figma)](https://figma.com)
[![Built with Builder.io](https://img.shields.io/badge/Built%20with-Builder.io-6B4FBB?logo=builder.io)](https://builder.io)
[![Powered by Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.0-8E75B2)](https://deepmind.google/technologies/gemini/)

[Get Started](#-quick-start) • [Documentation](./docs) • [Report Issue](https://github.com/KevinDyerAU/NytroAI/issues)

</div>

---

## What is NytroAI?

NytroAI helps Australian RTOs (Registered Training Organisations) validate their training assessments against unit requirements using AI. Upload your assessment documents, and get instant feedback on compliance, gaps, and recommendations.

### Why Use NytroAI?

**Save Time** - What takes hours manually now takes minutes with AI

**Ensure Compliance** - Automatically check against all unit requirements

**Improve Quality** - Get smart questions to fill assessment gaps

**Stay Organized** - Track all validations in one dashboard

---

## ✨ Key Features

- **AI Validation** - Automatically checks assessments against unit requirements
- **Smart Questions** - Generates questions to address gaps (with regeneration)
- **Instant Results** - Real-time validation with detailed reports
- **Easy Upload** - Drag and drop PDF assessments
- **Dashboard** - Track all validations in one place

---

## 🚀 Quick Start

### 1. Get Your API Keys

You'll need two free accounts:

- **Supabase** (database) - [Sign up here](https://supabase.com)
- **Google AI Studio** (AI) - [Get API key here](https://aistudio.google.com/app/apikey)

### 2. Install

```bash
# Clone the repository
git clone https://github.com/KevinDyerAU/NytroAI.git
cd NytroAI

# Install dependencies
npm install
```

### 3. Configure

Create a `.env.local` file with your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup Database

```bash
# Link to your Supabase project
supabase link --project-ref your_project_ref

# Setup database (one command!)
supabase db push
```

### 5. Run

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. Done! 🎉

---

## 📖 How It Works

```
Upload Assessment → AI Analyzes → Get Results → Download Report
```

1. **Upload** - Drag and drop your assessment PDF
2. **Select Unit** - Choose the unit of competency to validate against
3. **Wait** - AI analyzes your assessment (usually 1-2 minutes)
4. **Review** - See which requirements are met, partially met, or not met
5. **Improve** - Get smart questions to address gaps
6. **Export** - Download detailed compliance report

---

## 🎯 What Gets Validated?

NytroAI checks your assessment against:

- ✅ Knowledge Evidence
- ✅ Performance Evidence
- ✅ Foundation Skills
- ✅ Elements & Performance Criteria
- ✅ Assessment Conditions

For each requirement, you get:
- **Status** - Met, Partial, or Not Met
- **Reasoning** - Why the AI made this decision
- **Evidence** - Which questions in your assessment address this
- **Smart Question** - A question you can add to fill gaps

---

## 📚 Documentation

- **[Quick Start Guide](./docs/QUICK_START.md)** - Get up and running in 5 minutes
- **[User Guide](./docs/USER_GUIDE.md)** - How to use NytroAI
- **[FAQ](./docs/FAQ.md)** - Common questions answered
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Fix common issues

**For Developers:**
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Technical documentation
- **[Contributing](./CONTRIBUTING.md)** - How to contribute
- **[Changelog](./CHANGELOG.md)** - What's new

---

## 🐛 Common Issues

### "Request timed out"
**Solution:** Check that edge functions are deployed in your Supabase dashboard.

### "Validation not starting"
**Solution:** Make sure you ran `supabase db push` to setup the database triggers.

### "No API key found"
**Solution:** Check your `.env.local` file has the correct keys.

Need more help? Check our [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Built With

- **Figma** - Design
- **Builder.io** - Development
- **Windsurf** - Development environment
- **Google Gemini 2.0** - AI validation
- **Supabase** - Database and backend
- **React** - Frontend framework

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/KevinDyerAU/NytroAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/KevinDyerAU/NytroAI/discussions)
- **Email:** [Contact Kevin Dyer](https://github.com/KevinDyerAU)

---

<div align="center">

**Made with ❤️ for Australian RTOs**

[⭐ Star us on GitHub](https://github.com/KevinDyerAU/NytroAI) if you find this useful!

</div>
