# টাস্ক ম্যানেজমেন্ট অ্যাপ — সম্পূর্ণ পরিকল্পনা (A to Z)

> সূত্র: ChatGPT শেয়ার করা কথোপকথন + আপনার ১০টা প্রশ্নের উত্তর। **এটা Version 2 (ফাইনাল ড্রাফট)**: সব সিদ্ধান্ত ১৪ নং অংশে লক করা আছে এবং নিচের অংশগুলোতে প্রয়োগ করা হয়েছে। যেখানে অনুমান আছে সেখানে **[অনুমান]** লেখা।

## 🔒 চূড়ান্ত সিদ্ধান্ত এক নজরে
| বিষয় | সিদ্ধান্ত |
|---|---|
| Visibility | ডিফল্ট: দাতা শুধু সরাসরি গ্রহীতার progress দেখবে। **Admin সেটিংস থেকে এটা কন্ট্রোল করা যাবে** (Direct only / Summary / Full chain) |
| Secretary → Unit প্রধানকে কাজ | **Phase 1-এই থাকছে**; সব ফিচার একসাথে |
| একজন একাধিক পদে | **হ্যাঁ** (যেমন Secretary + Unit প্রধান), role switcher সহ |
| কাজ বন্ধ | **দাতার Approve বাধ্যতামূলক** |
| প্ল্যাটফর্ম | **Web + Mobile App**, দুটো ভার্সন, একই backend |
| ভাষা | English UI (পরে বাংলা যোগ করা যায় এমনভাবে বানানো) |
| ফাইল ও নোট | নোট + **একাধিক attachment** |
| গোপনীয়তা | শুধু দাতা-গ্রহীতা দেখবে (বর্তমান নিয়মই) |
| Hosting | আপনার নিজস্ব **Coolify server** |
| Admin | **আলাদা একজন ডেডিকেটেড Admin user** (সংগঠন-কাঠামোর বাইরে) |

---

## ১. কেন বানাচ্ছি (Why)

**সমস্যা**
- প্রতিষ্ঠানে প্রায় ৩০–৪০ জন কর্মী। একজন আরেকজনকে কাজ দেয়, তারা সেই কাজের তথ্য পূরণ (task fill-up) করে।
- একসাথে কয়েকজনকে অনেক কাজ দিলে **কাজের কথা ভুলে যাওয়া** হয়।
- কে কাকে কাজ দিল, কাজটা কতদূর এগোল, এটা এখন ট্র্যাক করার নির্ভরযোগ্য উপায় নেই।
- কাজ নিচের দিকে হাত বদলায় (Director → Secretary → আরেকজন), কিন্তু প্রত্যেক ধাপে "কে কার কাছ থেকে বুঝে নিল" স্পষ্ট থাকে না।

**লক্ষ্য**
1. কোনো কাজ যেন ভুলে না যায় (reminder, due date, overdue alert)।
2. যে কাজ দিয়েছে সে সবসময় জানবে কাজটা কোথায় আছে।
3. সাংগঠনিক কাঠামো (Director → Assistant Director → Secretary → Secretariat/Unit) অনুযায়ী কাজ দেওয়া ও হাত বদলের পুরো ইতিহাস থাকবে।
4. ৩০–৪০ জনের জন্য সহজ, মোবাইল ও ওয়েব দুটোতেই ব্যবহারযোগ্য (UI English)।

**সফলতার মাপকাঠি**
- ৪ সপ্তাহ ব্যবহারের পর "ভুলে যাওয়া কাজ" প্রায় শূন্য।
- সব কাজে একজন দায়িত্বপ্রাপ্ত ব্যক্তি ও একটা deadline আছে।
- ৯০% কর্মী সপ্তাহে অন্তত একবার নিজের কাজের status আপডেট করে।

---

## ২. সাংগঠনিক কাঠামো (Organization Model)

```
প্রধান কার্যালয়
 ├─ Director
 │   └─ Assistant Director
 │        ├─ Secretary A ── Secretariat A (সদস্যরা)
 │        ├─ Secretary B ── Secretariat B (সদস্যরা)
 │        └─ Secretary C ── Secretariat C (সদস্যরা)
 │
 └─ Unit / Branch (একাধিক)
      ├─ Unit Director (বা Unit প্রধান)
      ├─ Unit Assistant Director
      └─ Unit Secretary ── Unit Secretariat (সদস্যরা)
```

**মূল ধারণা**
- **Unit** = একটি বিভাগ বা শাখা। Head Office-ও একটা Unit হিসেবে ধরা হবে, তাহলে মডেল একই থাকে।
- **Position (পদ)**: Director, Assistant Director, Secretary, Member, Unit Head ইত্যাদি।
- **Secretariat**: একজন Secretary-র অধীনের সদস্যদের দল।
- **Reports-to (কার অধীনে)**: প্রত্যেক ব্যক্তির একজন সরাসরি ঊর্ধ্বতন থাকে। এটা দিয়েই সংগঠনের গাছ (tree) তৈরি হয়।

> গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত: কাঠামো hard-code না করে **ডাটা হিসেবে রাখব** (Unit, Position, reports_to)। তাহলে নতুন Unit বা পদ যোগ করলে কোড বদলাতে হবে না।

---

## ৩. কাজ দেওয়ার নিয়ম (Core Workflow)

### ৩.১ কে কাকে কাজ দিতে পারে
| দাতা | যাদের দিতে পারবে |
|---|---|
| Director | Assistant Director, Secretary, Unit প্রধান, যে কেউ (নিজের অধীন বা যে কোনো Secretary) |
| Assistant Director | Secretary, Unit প্রধান, নিজের অধীন সদস্য |
| Secretary | নিজের Secretariat-এর সদস্য, **এবং Unit প্রধানকে (Phase 1-এই)** |
| Unit প্রধান ও তার টিম | নিজের Unit-এর ভেতরে একই নিয়ম |

নিয়মটা কনফিগারযোগ্য রাখা হবে: "কোন পদ কোন পদকে কাজ দিতে পারে" একটা সারণি (permission matrix) থেকে নিয়ন্ত্রিত।

### ৩.২ কাজ দেওয়ার পর কী হয় (Delegation chain)
1. **Director** একটা কাজ **Secretary X**-কে দিলেন।
2. Secretary X চাইলে:
   - কাজটা **নিজেই করবেন**, অথবা
   - **আরেকজনকে forward/delegate** করবেন (নিজের Secretariat-এর সদস্য, বা আরেকজন)।
3. delegate করলে Secretary X-এর মূল কাজের নিচে একটা **সাব-টাস্ক** তৈরি হয়, যার দাতা = Secretary X, গ্রহীতা = নতুন ব্যক্তি।
4. ওই ব্যক্তি আবার চাইলে আরও নিচে দিতে পারেন (সীমাহীন গভীরতা, তবে সাধারণত ২–৩ ধাপ)।

```
Director ──► Secretary X   (Task #1)
                 └──► সদস্য M   (Sub-task #1.1, দাতা: Secretary X)
                          └──► সদস্য N  (Sub-task #1.1.1, দাতা: M)
```

### ৩.৩ "বুঝে নেওয়া" (Acknowledgement)
- Director যাকে কাজ দিলেন (Secretary X), সে **তার কাছ থেকেই** কাজ বুঝে নেবে।
- Secretary X যাকে দিলেন (M), সে **Secretary X-এর কাছ থেকেই** বুঝে নেবে।
- অ্যাপে এটা হবে প্রতি ধাপে: **"কাজটি বুঝেছি (Accept)"** বোতাম। না বুঝলে **"প্রশ্ন আছে"** বা **"ফেরত পাঠান"** (কারণসহ)।
- Accept না করা পর্যন্ত কাজ "Pending Acceptance" অবস্থায় থাকবে এবং reminder যাবে।

### ৩.৪ একসাথে অনেক কাজ / অনেক জনকে (ভুলে যাওয়ার মূল সমাধান)
- একই কাজ **একাধিক ব্যক্তিকে একসাথে** দেওয়া যাবে (প্রত্যেকের জন্য আলাদা assignment, আলাদা progress)।
- একজন দাতা অনেকগুলো কাজ দিলে আলাদা "আমি যা দিয়েছি" ড্যাশবোর্ডে সব এক জায়গায় থাকবে।
- Quick-add: এক ফর্মে একাধিক কাজ লিখে (প্রতি লাইনে একটা) দেওয়া যাবে।

---

## ৪. কে কী দেখতে পাবে (Visibility Rules)

**আপনার স্পষ্টীকরণ অনুযায়ী (Phase 1 নিয়ম):**

> যে কাজ **দিয়েছে**, সে **শুধু তার সরাসরি গ্রহীতার** progress দেখবে। নিচের ধাপে কী হচ্ছে তা সে দেখবে না।

উদাহরণ:
- Director → Secretary X: Director শুধু **Secretary X-এর** দেওয়া আপডেট ও status দেখবেন।
- Secretary X → সদস্য M: Secretary X দেখবেন **M-এর** progress।
- Director, M-এর progress সরাসরি দেখবেন না (Phase 1-এ)।
- Assistant Director যদি Unit প্রধানকে কাজ দেন, AD দেখবেন **ঐ Unit প্রধানের** progress।

**সারসংক্ষেপ সারণি**
| ব্যক্তি | যা দেখতে পায় |
|---|---|
| গ্রহীতা | নিজের কাছে আসা কাজ + নিজের দেওয়া সাব-টাস্ক |
| দাতা | নিজের দেওয়া কাজ, শুধু সরাসরি গ্রহীতার status/update |
| অন্য কেউ | কিছুই না (কাজের সাথে যুক্ত না হলে) |

**Admin-নিয়ন্ত্রিত Visibility Mode (আপনার সিদ্ধান্ত অনুযায়ী Phase 1-এ থাকছে)**

Admin সেটিংস থেকে তিন ধরনের mode বাছাই করতে পারবেন:
| Mode | দাতা কী দেখবে |
|---|---|
| **1. Direct only (ডিফল্ট)** | শুধু সরাসরি গ্রহীতার status ও update |
| **2. Summary** | সরাসরি গ্রহীতার বিস্তারিত + নিচের ধাপের সারাংশ ("৩টা সাব-টাস্ক, ২টা শেষ, ১টা overdue"), কারও নাম/মন্তব্য ছাড়া |
| **3. Full chain** | পুরো chain-এর সব ধাপ ও update |

সেটিং কোথায় কোথায় প্রযোজ্য হবে (কনফিগারেশন স্তর):
- **গ্লোবাল ডিফল্ট** (পুরো প্রতিষ্ঠান)
- **পদ/ভূমিকা ভিত্তিক** (যেমন: Director-এর জন্য Summary, বাকিদের জন্য Direct only)
- **ব্যক্তি ভিত্তিক override** (একজন নির্দিষ্ট ব্যবহারকারীর জন্য)
- অগ্রাধিকার: ব্যক্তি > পদ > গ্লোবাল

> **গুরুত্বপূর্ণ:** Visibility mode শুধু *দাতার* দেখার পরিধি বাড়ায়। যারা কাজের সাথে যুক্ত নয় তারা কখনো কিছু দেখবে না। Mode বদলানো audit log-এ থাকবে।

**Admin কি কাজের বিষয়বস্তু দেখতে পাবে?** [অনুমান] ডিফল্টে না। Admin ব্যবহারকারী, কাঠামো ও সেটিংস পরিচালনা করবেন; কাজের বিবরণ দেখতে চাইলে আলাদা "Audit access" সুইচ লাগবে, যেটা চালু করলে লগ হবে। এটা ১৪ নং অংশে নিশ্চিত করার প্রশ্ন হিসেবে রাখা হয়েছে।

---

## ৫. ফিচার তালিকা

### ৫.১ MVP (Phase 1) — অবশ্যই থাকবে
1. **লগইন ও ব্যবহারকারী ব্যবস্থাপনা** (Admin কর্মী যোগ করে, পদ ও "কার অধীনে" ঠিক করে)।
2. **Unit / পদ / Secretariat সেটআপ** (Admin প্যানেল)।
3. **কাজ তৈরি**: শিরোনাম, বিবরণ, গ্রহীতা (একাধিক), deadline, priority (জরুরি/সাধারণ/কম), সংযুক্তি (ফাইল/ছবি)।
4. **Forward/Delegate**: কাজ আরেকজনকে দেওয়া, সাব-টাস্ক তৈরি।
5. **Accept / প্রশ্ন / ফেরত** (কারণসহ)।
6. **Status**: নতুন → বুঝেছি → চলছে → সম্পন্ন (+ আটকে আছে/Blocked)।
7. **Progress update**: গ্রহীতা মন্তব্য ও শতকরা অগ্রগতি দেয়।
8. **দাতার কাজ বন্ধ করা**: গ্রহীতা "সম্পন্ন" দিলে দাতা **Approve** করলে তবেই কাজ বন্ধ (নইলে "আরও কাজ লাগবে" বলে ফেরত)।
9. **Dashboard**:
   - "আমার কাজ" (আজ / এই সপ্তাহ / overdue)
   - "আমি যা দিয়েছি" (গ্রহীতাভিত্তিক status)
10. **Reminder ও Notification** (নিচে বিস্তারিত)।
11. **Activity history**: কে কখন কী করল (অডিট লগ)।
12. **একাধিক পদ ও Role Switcher**: একজন ব্যবহারকারীর একাধিক পদ থাকতে পারবে (যেমন Secretary + Unit প্রধান)। কাজ দেওয়া/নেওয়ার সময় কোন পদে আছেন তা দেখাবে; কাজ কোন পদের নামে এসেছে সেটাও রেকর্ড থাকবে।
13. **Admin-নিয়ন্ত্রিত Visibility Mode** (৪ নং অংশ)।
14. **নোট ও একাধিক Attachment**: প্রতিটি কাজ ও প্রতিটি update-এ নোট এবং একাধিক ফাইল (ছবি, PDF, ডকুমেন্ট)।
15. **Web + Mobile App** দুটোই, একই API-তে।
16. **Secretary → Unit প্রধান** সহ সব ধরনের delegation।

### ৫.২ Phase 2
- ফিল্টার/সার্চ, কাজের ট্যাগ/ক্যাটেগরি।
- Recurring task (সাপ্তাহিক/মাসিক রিপোর্ট ইত্যাদি)।
- Comment thread, @mention।
- Escalation: Overdue হলে দাতাকে স্বয়ংক্রিয় alert।
- সাপ্তাহিক রিপোর্ট (PDF/Excel): কে কতটা কাজ করল, দেরি কতগুলো।
- Template: বারবার দেওয়া কাজের ছাঁচ।

### ৫.৩ Phase 3 (পরে ভাবব)
- বাংলা ভাষার UI।
- WhatsApp/Telegram/SMS ইন্টিগ্রেশন।
- ক্যালেন্ডার ভিউ, Kanban বোর্ড।
- Performance ড্যাশবোর্ড।
- Offline সাপোর্ট।

---

## ৬. ভুলে যাওয়া ঠেকানোর ব্যবস্থা (Reminder Engine)

| ঘটনা | কী হবে |
|---|---|
| নতুন কাজ পেলে | তাৎক্ষণিক notification |
| ২৪ ঘণ্টায় Accept না করলে | গ্রহীতাকে reminder, তারপর দাতাকে জানানো |
| Deadline-এর ১ দিন আগে | গ্রহীতাকে reminder |
| Deadline-এর দিন সকালে | গ্রহীতাকে reminder |
| Deadline পার হলে | গ্রহীতা ও দাতা দুজনকেই Overdue alert, প্রতিদিন পুনরাবৃত্তি |
| ৩ দিন কোনো update না থাকলে | গ্রহীতাকে "আপডেট দিন" nudge |
| প্রতিদিন সকাল ৮টা (কনফিগারযোগ্য) | **Daily digest**: "আজকের কাজ, overdue কাজ, নতুন কাজ" |
| দাতার জন্য সাপ্তাহিক digest | "আপনার দেওয়া কাজের সারাংশ: কোনটা আটকে, কোনটা দেরি" |

**চ্যানেল**: Mobile push (FCM/APNs), Web push, ইমেইল। পরে WhatsApp/Telegram। প্রত্যেক ব্যবহারকারী নিজের পছন্দমতো চ্যানেল ও digest সময় বদলাতে পারবে।

> একসাথে অনেক কাজ দিলে যে সমস্যা হয়, তার জন্য: গ্রহীতার "আজকের তালিকা" **অগ্রাধিকার অনুযায়ী সাজানো** থাকবে এবং Daily digest-এ সবচেয়ে জরুরি ৫টা আগে দেখাবে।

---

## ৭. ডাটা মডেল (Database)

**মূল টেবিল**
- `units` — id, name, parent_unit_id, type (head_office / unit)
- `positions` — id, title (Director, AD, Secretary, Member, Unit Head…), level
- `users` — id, name, phone, email, password_hash, is_active, is_admin (ডেডিকেটেড Admin অ্যাকাউন্টের জন্য; সংগঠন-কাঠামোতে থাকে না)
- `user_positions` — id, user_id, unit_id, position_id, **reports_to_user_id**, secretariat_id, is_primary (**একজনের একাধিক সারি = একাধিক পদ**)
- `secretariats` — id, secretary_user_id, unit_id, name
- `visibility_settings` — id, scope (global / position / user), scope_ref_id, mode (direct / summary / full), updated_by, updated_at
- `device_tokens` — id, user_id, platform (ios/android/web), push_token (মোবাইল push-এর জন্য)
- `tasks` — id, **parent_task_id** (null হলে মূল কাজ), root_task_id, title, description, priority, due_date, created_by (দাতা), created_at, closed_at
- `task_assignments` — id, task_id, assignee_user_id, assignee_position_id, assigned_by, assigned_by_position_id, status, accepted_at, completed_at, progress_percent (একটা কাজে একাধিক গ্রহীতা থাকতে পারে বলে আলাদা টেবিল)
- `task_updates` — id, assignment_id, user_id, type (comment / status_change / progress), body, created_at
- `attachments` — id, task_id/update_id (যেকোনো একটা), file_key (S3/MinIO), file_name, mime_type, size, uploaded_by (একটা কাজ/update-এ **একাধিক**; সর্বোচ্চ সাইজ/সংখ্যা কনফিগারযোগ্য, যেমন ফাইলপ্রতি ২৫MB)
- `task_notes` — id, task_id, user_id, body, created_at (ব্যক্তিগত বা শেয়ার্ড নোট)
- `notifications` — id, user_id, type, payload, read_at, created_at
- `reminder_rules` — কনফিগারযোগ্য সময়সূচি
- `delegation_permissions` — from_position_id, to_position_id (কে কাকে দিতে পারে)
- `audit_log` — actor, action, entity, before/after, time

**দৃশ্যমানতার প্রশ্ন (query)**
- "আমার দেওয়া কাজ" = `tasks.created_by = me`, এবং শুধু `task_assignments` যেখানে `assigned_by = me`।
- "আমার কাছে আসা কাজ" = `task_assignments.assignee_user_id = me`।
- এতে ডিফল্ট নিয়ম (শুধু সরাসরি গ্রহীতার progress) প্রাকৃতিকভাবেই আসে।
- Summary/Full mode-এ `tasks.root_task_id` ও `parent_task_id` ধরে descendant সাব-টাস্ক recursive query (Postgres `WITH RECURSIVE`) দিয়ে এনে mode অনুযায়ী ফিল্টার/সারাংশ করা হবে। সব চেক **server-side**।

---

## ৮. স্ক্রিন তালিকা

1. লগইন
2. **হোম / আমার ডেস্ক**: আজকের কাজ, overdue, নতুন আসা (Accept বাকি)
3. **কাজের বিস্তারিত**: বিবরণ, deadline, history, update ফর্ম, Forward বোতাম
4. **নতুন কাজ দিন**: ফর্ম (একাধিক গ্রহীতা বাছাই, deadline, priority, ফাইল)
5. **আমি যা দিয়েছি**: গ্রহীতাভিত্তিক তালিকা ও status রঙ (সবুজ/হলুদ/লাল)
6. **Forward / Delegate** স্ক্রিন
7. **Notification কেন্দ্র**
8. **Admin প্যানেল** (শুধু ডেডিকেটেড Admin): Unit, পদ, কর্মী, একাধিক পদ নির্ধারণ, "কার অধীনে", permission matrix, **Visibility Mode সেটিংস**, reminder সময়সূচি, audit log
9. **Role Switcher** (হেডারে): একাধিক পদ থাকলে বাছাই
10. **রিপোর্ট** (Phase 2)

UI নীতি: English UI (পরে i18n দিয়ে বাংলা যোগ), বড় বোতাম, মোবাইল-ফার্স্ট, কম ক্লিকে কাজ দেওয়া (৩০ সেকেন্ডের মধ্যে একটা কাজ দেওয়া যাবে)। Web ও App-এর স্ক্রিন একই কাঠামোর।

---

## ৯. প্রযুক্তি প্রস্তাব **[অনুমান]**

৩০–৪০ জনের জন্য সহজ ও সস্তা, তবু বাড়ানো যায় এমন:

Web ও App দুটোই লাগবে, তাই **API-first** স্থাপত্য: একটাই backend, দুটো client।

```
 Web (Next.js)  ─┐
                 ├──► REST API (NestJS) ──► PostgreSQL
 Mobile App ────┘          │ ├──► Redis + Worker (reminder/digest/push)
 (Expo React Native)       │ └──► MinIO (attachments)
```

- **Backend/API**: NestJS (TypeScript) + Prisma ORM। JWT auth (access + refresh token)।
- **Database**: PostgreSQL (গাছ-কাঠামো ও recursive query-র জন্য ভালো)।
- **Web**: Next.js (React) + Tailwind।
- **Mobile App**: Expo (React Native), Android + iOS, web-এর সাথে TypeScript টাইপ/validation শেয়ার করা যাবে। [অনুমান: আপনি JS/TS-এ স্বচ্ছন্দ। Flutter চাইলে API একই থাকবে, শুধু client বদলাবে]
- **Background jobs**: BullMQ + Redis (reminder, daily digest, overdue check, escalation)।
- **Notification**: মোবাইলে FCM/APNs push, ওয়েবে Web Push, সাথে Email (SMTP)। পরে WhatsApp।
- **ফাইল স্টোরেজ**: Coolify-তে self-hosted **MinIO** (S3-সামঞ্জস্যপূর্ণ); upload করতে pre-signed URL।
- **Realtime (ঐচ্ছিক)**: নতুন কাজ/update তাৎক্ষণিক দেখাতে WebSocket বা SSE।

**Coolify ডিপ্লয়মেন্ট (আপনার সার্ভারে)**
- একটা Coolify প্রজেক্টে সার্ভিসগুলো: `api`, `worker`, `web`, `postgres`, `redis`, `minio`।
- Git repo থেকে auto-deploy, আলাদা `staging` ও `production` environment।
- Domain + HTTPS (Coolify-র Let's Encrypt), যেমন `tasks.yourorg.com` ও `api.tasks.yourorg.com`।
- **ব্যাকআপ**: Postgres-এর দৈনিক স্বয়ংক্রিয় backup (Coolify-র scheduled backup) অন্য কোথাও (আলাদা S3/অন্য সার্ভার) পাঠানো, আর MinIO bucket-ও ব্যাকআপ। **ব্যাকআপ restore একবার পরীক্ষা করে দেখা বাধ্যতামূলক।**
- Secrets Coolify-র environment variable-এ; কোডে নয়।
- Monitoring: Coolify health check + সাধারণ uptime monitor।
- **Mobile App বিতরণ**: Android APK/Play Store, iOS TestFlight/App Store। ৩০–৪০ জন হলে শুরুতে internal distribution (APK সরাসরি, iOS-এ TestFlight) যথেষ্ট। Play/App Store ডেভেলপার অ্যাকাউন্ট লাগলে তার খরচ আলাদা।

---

## ১০. নিরাপত্তা ও গোপনীয়তা

- কেউ নিজের permission-এর বাইরের কাজ দেখতে পারবে না (সার্ভার-সাইডে যাচাই, শুধু UI লুকানো নয়)।
- সব পরিবর্তন audit log-এ।
- পাসওয়ার্ড hash, HTTPS বাধ্যতামূলক।
- কর্মী চলে গেলে account নিষ্ক্রিয় করা যাবে, তার চলমান কাজ **পুনর্বণ্টন (reassign)** করার অপশন।
- নিয়মিত ডাটাবেস ব্যাকআপ।

---

## ১১. বাস্তবায়ন রোডম্যাপ

| ধাপ | সময় (আনুমানিক) | কাজ |
|---|---|---|
| ০. প্রস্তুতি | ১ সপ্তাহ | ৩–৪ জনের সাথে বসে workflow যাচাই, খোলা প্রশ্নের উত্তর, সত্যিকারের কাজের উদাহরণ সংগ্রহ |
| ১. ভিত্তি | ২ সপ্তাহ | Repo/monorepo, Coolify সেটআপ (staging), DB schema, auth, ডেডিকেটেড Admin, Unit/পদ/কর্মী/একাধিক পদ, Admin প্যানেল |
| ২. কোর API | ৩ সপ্তাহ | কাজ তৈরি, একাধিক গ্রহীতা, Accept/ফেরত, status, progress, delegate/সাব-টাস্ক (Secretary→Unit প্রধান সহ), Approve-to-close, permission matrix |
| ৩. Visibility ও Attachment | ১–২ সপ্তাহ | Visibility Mode (Direct/Summary/Full, global/পদ/ব্যক্তি), নোট, multiple attachment (MinIO) |
| ৪. Web UI | ৩ সপ্তাহ | আমার ডেস্ক, আমি যা দিয়েছি, কাজের বিস্তারিত, Role switcher, Admin প্যানেল UI |
| ৫. Mobile App | ৩ সপ্তাহ | মূল স্ক্রিনগুলো (ডেস্ক, কাজ দেওয়া, Accept, update, attachment, notification), push |
| ৬. Reminder Engine | ১ সপ্তাহ | worker, deadline/overdue, daily digest, push + email |
| ৭. পাইলট | ২–৪ সপ্তাহ | একটা Unit বা ৮–১০ জন নিয়ে চালানো, feedback, bug fix |
| ৮. Production চালু | ১ সপ্তাহ | ব্যাকআপ restore টেস্ট, প্রশিক্ষণ, ডাটা ইনপুট, app বিতরণ |
| ৯. Phase 2 | পরে | recurring, রিপোর্ট, escalation, comment thread, বাংলা UI, WhatsApp |

**সম্পূর্ণ MVP (পাইলট বাদে): প্রায় ১৩–১৬ সপ্তাহ** (একজন ডেভেলপার)। Web ও App দুটো একসাথে + সব ফিচার Phase 1-এ রাখায় সময় বেড়েছে। সময় কমাতে চাইলে বিকল্প: প্রথমে Web আগে চালু করে পাইলট চালানো, App ৫ নং ধাপ পরে যোগ করা (backend একই থাকায় কোনো কাজ নষ্ট হবে না)।

---

## ১২. চালু করার কৌশল (Adoption)

অ্যাপ ভালো হলেও কর্মীরা না ব্যবহার করলে ব্যর্থ। তাই:
- **শীর্ষ স্তর আগে**: Director/AD/Secretary নিজেরা এই অ্যাপেই কাজ দেবেন, মুখে বা অন্য চ্যানেলে নয়। নিয়ম: "অ্যাপে নেই মানে কাজ দেওয়া হয়নি"।
- ছোট পাইলট দিয়ে শুরু, সফল হলে বাকিদের আনা।
- ১ পাতার বাংলা গাইড ও ৩০ মিনিটের হাতে-কলমে প্রশিক্ষণ।
- সাপ্তাহিক মিটিংয়ে অ্যাপের dashboard দেখে আলোচনা।
- প্রথম মাসে একজন "অ্যাপ চ্যাম্পিয়ন" নিযুক্ত করা যিনি সাহায্য করবেন।

---

## ১৩. ঝুঁকি ও সমাধান

| ঝুঁকি | সমাধান |
|---|---|
| কর্মীরা update দেয় না | সহজ UI, reminder, দাতার তাগিদ, সাপ্তাহিক পর্যালোচনা |
| Notification-এর ভিড়ে মূল বার্তা হারায় | digest, priority অনুযায়ী ফিল্টার, কনফিগারযোগ্য সময় |
| কাঠামো বদলায় (পদ/বিভাগ) | কাঠামো ডাটা-চালিত, Admin বদলাতে পারবে |
| কর্মী বদলি/ছুটি | Reassign ও "প্রতিনিধি (delegate-in-absence)" সুবিধা |
| অতিরিক্ত জটিলতা | MVP-তে সীমাবদ্ধ থাকা; Phase 2/3 পরে |
| ইন্টারনেট দুর্বল | হালকা PWA, পরে offline cache |

---

## ১৪. সিদ্ধান্ত লগ (আপনার উত্তর) ও বাকি প্রশ্ন

### ✅ লক করা সিদ্ধান্ত
1. **Visibility** — ডিফল্ট Direct only; Admin সেটিংস থেকে Summary/Full chain চালু করা যাবে (গ্লোবাল/পদ/ব্যক্তি স্তরে)। → ৪ নং অংশ
2. **Secretary → Unit প্রধান** — Phase 1-এই, সব একসাথে। → ৩.১
3. **একাধিক পদ** — হ্যাঁ। `user_positions` টেবিল + Role Switcher। → ৫.১ (১২), ৭
4. **Approve** — দাতার Approve বাধ্যতামূলক। → ৫.১ (৮)
5. **প্ল্যাটফর্ম** — Web + Mobile App, দুটো ভার্সন। → ৯
6. **ভাষা** — English UI (আপনার লেখা "enlishlish" আমি English ধরেছি, ভুল হলে জানান)। বাংলা Phase 3-এ।
7. **ফাইল** — নোট + একাধিক attachment। → ৭
8. **গোপনীয়তা** — শুধু দাতা-গ্রহীতা। → ৪
9. **Hosting** — নিজস্ব Coolify server। → ৯
10. **Admin** — আলাদা ডেডিকেটেড user, সংগঠন-কাঠামোর বাইরে। → ৪, ৭

### ❓ নতুন ছোট প্রশ্ন (এগুলো আমি ডিফল্ট ধরে এগোব, বদলাতে চাইলে বলবেন)
| # | প্রশ্ন | ডিফল্ট ধারণা |
|---|---|---|
| A | Admin কি কাজের বিষয়বস্তু দেখতে পারবে? | না। আলাদা লগ-করা "Audit access" সুইচ থাকবে |
| B | একাধিক পদধারী ব্যক্তি কাজ পাবে কোন পদের নামে? | কাজ দেওয়ার সময় দাতা নির্দিষ্ট পদ বা ব্যক্তি বাছাই করবে; ব্যক্তি বাছলে primary পদ |
| C | Attachment-এর সর্বোচ্চ সাইজ | ফাইলপ্রতি ২৫MB, কাজপ্রতি ২০টা |
| D | iOS app লাগবে, নাকি শুধু Android? | দুটোই; iOS-এ Apple Developer অ্যাকাউন্ট (বার্ষিক ফি) লাগবে |
| E | প্রথমে Web আগে চালু করে পরে App? | হ্যাঁ, ঝুঁকি কমায় (১১ নং অংশ) |
| F | Mobile app সবার ফোনে কীভাবে যাবে? | Play Store/App Store, অথবা শুরুতে APK/TestFlight |

---

## ১৫. পরবর্তী পদক্ষেপ

1. A–F-এর ডিফল্টগুলো দেখে নিন; আপত্তি না থাকলে চুপ থাকলেই চলবে।
2. কাঠামো (কে কার অধীনে, কার কত পদ) একটা Excel-এ লিখে রাখুন। এটাই Admin সেটআপের প্রাথমিক ডাটা হবে।
3. সত্যিকারের ৫–১০টা কাজ কাগজে এই workflow-তে "চালিয়ে" দেখুন (Director → Secretary → Unit প্রধান → সদস্য)।
4. Coolify সার্ভারের তথ্য নিশ্চিত করুন: RAM/CPU/ডিস্ক, domain, backup গন্তব্য।
5. **ধাপ ১ (ভিত্তি)** শুরু: monorepo (`api`, `web`, `mobile`, `shared`), DB schema, auth, Admin প্যানেল। আমি চাইলে এখানেই scaffold করে দিতে পারি।
