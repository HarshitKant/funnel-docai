<div align="center">

# FunnelDoc.ai

**Paste your funnel. Find the leak. Fix the revenue.**

*In 30 seconds, not 2 days.*

[![Live Demo](https://img.shields.io/badge/Live-Demo-6366F1?style=for-the-badge&logo=vercel&logoColor=white)](https://funnel-docai.lovable.app)
[![Built With](https://img.shields.io/badge/Built_With-Claude_AI-F97316?style=for-the-badge)](https://anthropic.com)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)

---

An AI-powered funnel diagnosis tool that turns raw conversion data into actionable hypotheses, validation patterns, and fixes — the same analysis a PM does manually in 2 days, delivered in 30 seconds.

[Live Demo](https://funnel-docai.lovable.app) · [Report Bug](https://github.com/HarshitKant/funnel-docai/issues) · [Request Feature](https://github.com/HarshitKant/funnel-docai/issues)

</div>

---

## 🎯 The Problem

Every growth team diagnoses funnels the same way:

> Export data → Write SQL → Segment by device/geo/source → Form hypotheses → Validate → Recommend fixes

This takes **2-3 days** every time a metric drops. I know because I've done it.

At IpserLabs, I built a healthcare marketplace from zero, instrumented the full booking funnel, found a **79% drop-off** on high-intent users, and shipped fixes that improved conversion by **50%**. The diagnosis alone took weeks.

**FunnelDoc packages that entire diagnostic process into an AI agent that runs in 30 seconds.**

---

## ⚡ How It Works

```
┌─────────────────────────┐
│  Enter funnel data       │  ← Paste steps + user counts
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Visual preview          │  ← Bar chart with kill zone in red
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  AI diagnosis            │  ← Claude analyzes like a PM would
└────────────┬────────────┘
             ▼
┌─────────────────────────────────────────────┐
│                                             │
│  ✅ Kill zone identified                    │
│  ✅ Step-by-step severity breakdown         │
│  ✅ 5 segmentation dimensions               │
│  ✅ 3 ranked hypotheses                     │
│     → TRUE pattern (confirms)               │
│     → FALSE pattern (rejects)               │
│  ✅ 3 product fixes linked to root causes   │
│  ✅ Diagnostic SQL query                    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🧠 What Makes This Different

| Feature | Manual PM Process | FunnelDoc |
|---|---|---|
| Identify biggest drop-off | 30 min pulling data | Instant |
| Segment analysis | 2-4 hours writing SQL | Auto-suggested dimensions |
| Form hypotheses | Half a day of analysis | 3 ranked in seconds |
| Validation plan | Often skipped entirely | TRUE/FALSE patterns for each |
| Recommended fixes | Meeting with the team | Linked to specific hypotheses |
| Diagnostic SQL | Write from scratch | Auto-generated |
| **Total time** | **2-3 days** | **30 seconds** |

---

## 🏗️ Product Decisions

> These aren't technical decisions. They're product decisions.

**Why hypotheses have TRUE/FALSE patterns**

Most funnel analysis stops at "we think X is the problem." FunnelDoc forces each hypothesis to define what data would confirm OR reject it. This prevents confirmation bias and gives the PM a clear next step — not just a theory.

**Why SQL queries are auto-generated**

The gap between "we have a hypothesis" and "we validated it" is usually a 2-hour SQL session that gets deprioritized. FunnelDoc bridges that gap by writing the first diagnostic query automatically, using the actual step names from your funnel.

**Why fixes are linked to hypotheses**

Recommendations without diagnosis are guesses. Every suggested fix maps to a specific hypothesis so the PM knows exactly which root cause they're addressing and can verify the fix worked.

**Why there's a local fallback engine**

AI APIs fail. The local engine calculates drop-offs mathematically and generates contextual hypotheses based on the specific funnel steps. The tool delivers value even offline.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| AI Engine | Claude API (Anthropic) + local fallback |
| Charts | Recharts |
| Build Tool | Lovable |
| Deployment | Lovable |

---

## 🚀 Getting Started

**Use the live demo**

👉 [funnel-docai.lovable.app](https://funnel-docai.lovable.app)

**Run locally**

```bash
git clone https://github.com/HarshitKant/funnel-docai.git
cd funnel-docai
npm install
npm run dev
```

---

## 📊 Sample Analysis

Input a funnel like this:

```
Landing Page         → 10,000 users
Sign Up Started      →  6,400 users
Email Verified       →  3,800 users
KYC Started          →  2,900 users
KYC Completed        →  1,200 users
First Transaction    →    580 users
```

FunnelDoc returns:

- **Overall conversion:** 5.8%
- **Kill zone:** KYC Started → KYC Completed (58.6% drop) 🔴
- **Top hypothesis:** KYC form is too complex on mobile — validate by comparing completion rate across devices
- **Top fix:** Reduce KYC to 2 steps with progress indicator
- **SQL query:** Segments KYC completion by device type and traffic source

---

## 🧬 The Backstory

I built this because I've been the human version of this tool.

At IpserLabs, I spent weeks doing what FunnelDoc does in 30 seconds — instrumenting funnels with SQL and Mixpanel, calling users who dropped off when surveys failed (3% response rate on 1,000 users — useless), discovering that a missing price tag on the confirmation screen was killing 79% of high-intent bookings, and shipping three targeted fixes.

The diagnosis was the hard part. The fixes were obvious once the diagnosis was right.

FunnelDoc is that diagnostic expertise packaged as an AI agent. Every growth team has someone doing this work manually. This tool does it for them.

---

## 📝 Future Roadmap

- [ ] Mixpanel / Amplitude direct integration
- [ ] Auto-monitoring — alert when a funnel step degrades beyond threshold
- [ ] Slack bot — `/funneldoc diagnose checkout` in any channel
- [ ] Historical comparison — this week vs last week vs last month
- [ ] Team collaboration — share diagnosis and assign fixes
- [ ] A/B test impact prediction based on historical data

---

## 👤 Built By

<div align="center">

**Harshit Kant** — Product Manager

*I've been the human version of this tool. Now it runs in 30 seconds instead of 2 days.*

[![Portfolio](https://img.shields.io/badge/Portfolio-000?style=for-the-badge&logo=vercel&logoColor=white)](https://harshitkant.lovable.app)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/harshitkant)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/HarshitKant)
[![Email](https://img.shields.io/badge/Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:hkant27008@gmail.com)

</div>

---

<div align="center">
<sub>Built in 1 day with Claude + Lovable. Because the best way to show you can build AI products is to build one.</sub>
</div>
