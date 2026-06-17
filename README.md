# matab — Clinic Management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/abdulrehmankz1/clinic-management?style=social)](https://github.com/abdulrehmankz1/clinic-management/stargazers)
[![Forks](https://img.shields.io/github/forks/abdulrehmankz1/clinic-management?style=social)](https://github.com/abdulrehmankz1/clinic-management/network/members)

A multi-tenant **clinic management** system built with **Payload CMS 3**, **Next.js 16**
and **MongoDB**. Many clinics share one deployment, but each clinic sees only its own
data — built around one non-negotiable rule: **a clinic can never see or touch another
clinic's data.** v1 covers the multi-tenant core: staff & roles, patients, appointments
with a double-booking guard, walk-in tokens and a dashboard.

> ⭐ **Like this project?** Give it a star and feel free to fork it — it really helps and
> keeps the project going!

![matab day view](public/images/product-day-view.png)

## 🎬 Demo — owner walkthrough

A single end-to-end run as a clinic **owner**, covering the everyday front-desk flow:
booking three ways (scheduled, walk-in, and a brand-new patient added inline), seeing
where bookings land on the day view, registering a patient, adding a doctor, and reviewing
clinic settings.

<img src="demo-videos/owner-full-walkthrough.gif" alt="Owner walkthrough — booking, patients, staff & settings" width="720">

<sub>▶ Full quality: <a href="demo-videos/owner-full-walkthrough.mp4">watch the MP4</a></sub>

**What it shows**

- **Booking, three ways** — a scheduled (online) appointment for an existing patient, a
  **walk-in** that gets a queue token, and a brand-new patient added inline while booking.
- **Where they land** — each booking appears on the per-doctor **day view** timeline.
- **Patients** — searchable directory + registering a new patient with a full medical
  record (MRN auto-assigned).
- **Staff** — adding a new doctor with specialty, fee and weekly availability.
- **Settings** — clinic profile, working hours, currency & timezone.

## The problem

Small clinics — one to a few doctors, a receptionist — still run on paper appointment
registers, patient histories in loose files, and a cash drawer. Existing hospital systems
are expensive, complex, and assume IT staff. There's a gap for a cheap, simple,
multi-clinic tool a receptionist can learn in half an hour.

## ✨ Features (v1)

- **Multi-tenancy** — one app, one database, fully isolated clinics ("tenants").
- **Auth & roles** — `superAdmin` (platform), and per-clinic `owner`, `doctor`,
  `receptionist`, each with its own access.
- **Patients** — register/search by name, phone or MRN; auto per-clinic patient numbers
  (`P-0001`); allergy banner; same-number dedupe warning (families share phones).
- **Appointments** — a day view with two modes: a **queue List** (time-ordered, one-tap
  *Check in / Complete* — built for non-technical front-desk staff) and a per-doctor
  **Timeline** (availability windows, now-line, side-by-side lanes for overlapping slots).
  Status flow (`scheduled → checked-in → completed / cancelled / no-show`) and a
  **double-booking guard** that rejects overlapping slots.
- **Doctor availability** — each doctor is `regular` (set weekdays + a daily window, e.g.
  Mon/Wed/Fri 4–6pm), `on-call` (any time), or `by-appointment` (visiting surgeon — hidden
  from the auto finder). Bookings are blocked outside a regular doctor's window, and a
  **"which doctors are free at this time?"** finder powers the call-in flow.
- **Walk-ins** — first-come-first-serve with an auto **token number** (`T-01`, `T-02`…)
  per clinic per day, shown on the Day Rail.
- **Dashboard** — today's KPIs, a 14-day activity chart, up-next list, doctors on duty,
  quick actions and recently registered patients.
- **Super admin console** — create clinics (owner created atomically), suspend/reactivate.
- **UI** — teal "clinical calm" design system on Tailwind v4 + shadcn/ui; dark sidebar app
  chrome; landing page with one-click demo logins; spinner feedback on every pending action.

## 🔐 Multi-tenancy design

The tenant wall lives in **one place** — access-control functions (`src/access/`) that
return a Mongo `where` constraint Payload merges into every query, e.g.
`{ tenant: { equals: user.tenant } }`. It is **deny-by-default**: any request that can't
positively determine a tenant returns `false`.

- **Set it, don't trust it** — a `beforeChange` hook force-sets `tenant` from the
  logged-in user; whatever the client sends is overwritten. `tenant` is immutable after create.
- **The client never decides scoping** — tenant is always derived server-side.
- **Custom, not the plugin** — a ~150-line set of access helpers instead of the official
  multi-tenant plugin, so every line is explainable and there's no version coupling.
- **Proven by tests** — `tests/int/isolation.int.spec.ts` asserts cross-tenant
  reads/writes fail and that planted foreign tenants are force-corrected.

## ⏱️ Double-booking guard

Two appointments for the same doctor conflict iff
`existing.start < new.end && existing.end > new.start` (touching edges don't conflict).
The check runs **inside the request's MongoDB transaction**, and a **partial unique index**
on `(tenant, doctor, start)` (active statuses only) is the deterministic backstop so two
simultaneous bookings for the same slot can't both win — one aborts. A race test
(`Promise.all` of two identical bookings) proves exactly one succeeds.

## 🌍 Market-agnostic by design

Nothing region-specific is hardcoded. Each clinic has its own **currency** and **timezone**
as settings (defaults `PKR` / `Asia/Karachi`). All money flows through
`formatMoney(amount, tenant)` and all times through `formatTime(date, tenant)`. Pakistan is
the launch market, not a limitation.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| CMS / API / Auth | Payload CMS 3 |
| Web | Next.js 16 (App Router) + React 19 |
| DB | MongoDB (replica set — for transactions) |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI) + lucide-react |
| Tests | Vitest (Payload Local API integration tests) |

## 🚀 Getting started

```bash
pnpm install
cp .env.example .env          # then fill PAYLOAD_SECRET
docker compose up -d          # MongoDB as a single-node replica set (rs0)
pnpm seed                     # 3 demo clinics, staff, patients, appointments
pnpm dev                      # http://localhost:3000
```

> **Replica set is required.** The booking guard uses transactions, which only work on a
> replica set. `docker compose up -d` starts a single-node `rs0` and initializes it
> automatically. A standalone mongo silently makes transactions a no-op.

### Demo logins (password: `password123`)

| Role | Email |
|---|---|
| Super Admin | `super@clinic.app` |
| Owner — City Care | `owner@city.app` |
| Receptionist — City Care | `reception@city.app` |
| Doctor — City Care | `doctor1@city.app` |
| Owner — Shifa | `owner@shifa.app` |

Log in as City Care, then as Shifa — the data is completely different. That's the tenant wall.

## ✅ Tests

```bash
pnpm test                     # 34 integration tests: isolation, booking guard, availability, walk-in tokens
```

> Heads-up: the test suite currently shares the dev database and wipes it — run
> `pnpm seed` afterwards to restore the demo data.

## 📁 Project structure

```
src/
  access/         # the tenant wall — isSuperAdmin, tenantScoped, field-level rules
  app/(frontend)/ # landing, login, dashboard/* (appointments, patients, staff, settings), super
  app/(payload)/  # admin panel & REST/GraphQL API (super admin only)
  collections/    # Tenants, Users, Patients, Appointments
  components/     # DayRail (List + Timeline), BookingForm, StaffManager, SuperConsole, Sidebar, ui/
  hooks/          # forceTenant (set-it-don't-trust-it)
  lib/            # booking.ts, availability.ts, reports.ts, format.ts, constants.ts
  seed.ts
  payload.config.ts
public/images/    # landing/login photography (Unsplash) + product shot
tests/int/        # isolation, booking, overlap, availability, walk-in suites
```

## 🗺️ Roadmap

v1 (this) is the multi-tenant foundation. Later versions (clinical visits & prescriptions,
billing, self-serve signup) are planned but intentionally out of scope here.

## 🤝 Contributing

Contributions, issues and feature requests are welcome! The usual open-source flow:

1. **Fork** the repository — <https://github.com/abdulrehmankz1/clinic-management>
2. Create your feature branch — `git checkout -b feature/amazing-feature`
3. Commit your changes — `git commit -m "feat: add amazing feature"`
4. Push to the branch — `git push origin feature/amazing-feature`
5. Open a **Pull Request**

If you find this project useful, please ⭐ **star the repo** and consider **forking** it —
it helps others discover the project and motivates further development.

## 🙌 Credits & Attribution

Built and maintained by **Abdul Rehman** ([@abdulrehmankz1](https://github.com/abdulrehmankz1)).

You are free to use, modify and distribute this project under the terms of the MIT License.
If you use it in your own work — whether a fork, a derivative, or as a learning reference —
**please give credit** by linking back to the original repository:

> Based on [matab — Clinic Management](https://github.com/abdulrehmankz1/clinic-management)
> by [Abdul Rehman](https://github.com/abdulrehmankz1).

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for
details. You can use it commercially and privately, modify it and distribute it; just keep
the copyright and license notice intact.
