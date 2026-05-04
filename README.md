# 🎓 LicentaConnect USV

A platform that helps students choose their Bachelor's thesis topic and supervisor using AI recommendations based on their interests and skills.

**University:** Stefan cel Mare University of Suceava (USV) - Faculty of Electrical Engineering and Computer Science (FIESC)  
**Author:** Adonicioaie Ovidiu Gabriel  
**Status:** Phase 1 Complete ✅

---

## 🚀 Quick Start

```bash
cd /Users/ovidiuadc/Facultate/ProiectLicenta
npm run dev
```

Open: **http://localhost:5173/**

---

## 📚 Documentation

**Start with:** [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)

Key files:
- [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md) - Project completion summary
- [START_HERE.md](./START_HERE.md) - Quick start guide (5 min read)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Code snippets and patterns
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Complete overview
- [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md) - All CLI commands

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v4
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **Build Tool:** Vite 7.3.1
- **Styling:** Tailwind CSS with custom USV theme

---

## 📋 Available Scripts

```bash
# Development
npm run dev       # Start dev server at http://localhost:5173/

# Production
npm run build     # Create optimized build
npm run preview   # Preview production build
```

---

## 🎨 Design System

**Colors:**
- Primary Navy: `#1e3a8a` (bg-usv-primary)
- Accent Gold: `#eab308` (bg-usv-accent)
- White: `#ffffff`
- Gray Scale: `bg-usv-gray-{50-900}`

**Typography:**
- Font: Inter (professional, academic)
- Responsive sizes: text-sm to text-6xl

---

## ✨ Features (Phase 1)

- ✅ Professional landing page
- ✅ Responsive navigation with mobile menu
- ✅ Custom color scheme matching USV branding
- ✅ "How It Works" feature section
- ✅ Multiple call-to-action buttons
- ✅ Professional footer
- ✅ Mobile-first responsive design
- ✅ Accessibility focus states
- ✅ Smooth animations and transitions

---

## 📁 Project Structure

```
src/
├── components/Layout.jsx        # Navbar, Footer, Layout wrapper
├── pages/LandingPage.jsx       # Landing page
├── App.jsx                     # Router configuration
├── index.css                   # Global styles
└── main.jsx                    # Entry point
```

---

## 🚀 Phase 2 Planning

Next features to build:
1. Authentication (Login/Register)
2. Student Profile Management
3. AI Recommendations Engine
4. Admin Dashboard
5. Backend API & Database

See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md#phase-2-planning) for details.

---

## 📖 For Developers

**New to the project?** Start here:
1. Read [START_HERE.md](./START_HERE.md) (5 minutes)
2. Keep [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) open while coding
3. Check other docs as needed

**Adding a new page?** See the pattern in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#adding-a-new-page-1-2-minutes)

**Styling tips?** See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#common-tailwind-patterns)

---

## ✅ Project Status

- ✅ Phase 1: Setup & Frontend Scaffolding - **COMPLETE**
- 🔜 Phase 2: Authentication & Profiles - Ready to start
- 🔜 Phase 3: AI Engine Integration - Planned
- 🔜 Phase 4: Admin & Analytics - Planned

---

## 🐛 Troubleshooting

**Dev server won't start?**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Styles not working?**
- Check Tailwind class names are correct
- Verify `tailwind.config.js` has the colors
- Restart dev server

**Port 5173 in use?**
```bash
npm run dev -- --port 3000
```

See [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md#🐛-debugging-commands) for more.

---

## 📞 Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Docs](https://react.dev)
- [React Router](https://reactrouter.com)
- [Lucide Icons](https://lucide.dev)
- [Vite Guide](https://vitejs.dev/guide/)

---

## 📝 License

Project for Stefan cel Mare University of Suceava (USV)

---

**Built with ❤️ for USV Bachelor's Thesis Platform**

Last updated: February 10, 2026
