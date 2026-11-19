# What واجباتي's users hate, and what تطبيق المعلم التعليمي does about it

Sample: **245 real Google Play reviews** (all 1–4★ reviews plus every 5★ review longer than 70 characters, out of 380 loaded), read on 2026-11-19 and checked against the live page by checksum: 245 of 245 exact. Every quote below is verbatim and linked in `reviews.csv` / `feedback.md`.
Caveats, stated honestly: one source only (no App Store/Reddit coverage), so the tool marks every theme "thin". The reviewers are Saudi-curriculum students; Sudanese students are a different audience, but the complaints are about the *app*, not the curriculum, so they transfer.

## 1. What they hate (ranked by evidence)

| # | problem | reviews | example (verbatim) |
| --- | --- | --- | --- |
| 1 | **Freezes, won't open, kicks you out of the subject** | 63 | "كل شوي يعللق وما يخليني ادخل برنامج جدا سيئ" |
| 2 | **"صفحة الويب غير متاحة"**: the app is a web wrapper; when the site failed on 6–7 Oct 2026 it broke for everyone | 19 (most on 6–7 Oct) | "حسبي الله النت كامل وكل شي تمام لاكنه يقول صفحة الويب غير متاحة … بكرا عندي اختبار" |
| 3 | **Slow loading** | 21 | "اسوء موقع للدراسه بشكل عام تحميل بطيء كل شيء بطيء" |
| 4 | **Wrong answers and typos**, with no way to report them | 28 | "للأسف التطبيق يحتوي على أخطاء مطبعية وإملائية فادحة في حلول المناهج" |
| 5 | **Ads**: too many, can't be skipped, open the store | 20 | "يوجد اعلانات في الشاشة لا يمكن تخطيها" |
| 6 | **Missing pages, solutions or whole semesters** | 16 | "لا يوجد فيه الفصل الدراسي الثالث" |
| 7 | **Inappropriate ads in a school app** | 3 | "اتمنى ازالة الاعلانات الخادشة للحياء فهناك الكثير من الطلاب والطالبات" |
| 8 | **Surprise carrier subscription** (STC "beyou") | 2 | "تم اشراكي في خدمة beyou دون طلبي" |

Together, #1–#3 (reliability) account for over a third of all complaints: the single biggest reason people leave.

## 2. What is missing (asked for by name)

| # | request | reviews | example |
| --- | --- | --- | --- |
| 1 | **Shorter answers**: "the answer is two words, the app writes a page" | 19 | "ثلاثة أرباع الأسئلة إجاباتها طويله … والإجابه بالصدق كلمتين" |
| 2 | **Works without internet** | 8 | "بس لو كان بدون شبكه رح تكون مميزه جداااا" |
| 3 | **Interactive tests that grade you** | 4 | "الاختبارات التي في التطبيق لا يمكن حلها او حتى تصحيحها" |
| 4 | **Better reading**: zoom, don't jump to the top, real page numbers | 4 | "ارجو ان يمكننا أن نكبرونصغربدينا ولا نطلع كل شويتين فوق" |
| 5 | **Dark mode** | 2 | "اقتراح لكم ان توضع شاشة ليلي الداكن" |

## 3. What is unsolved (whole jobs the app ignores)

- **Students on weak or prepaid data**: "نت مخلص ما اقدر احصل" / "تعطوني 1000رصيد". They can't afford to reload a book every time.
- **Studying the night before an exam**: the outage hit right before exams ("بكرا عندي اختبار"). The app is least reliable exactly when it matters most.
- **Trust**: students can't tell which answers are right, and nobody fixes reported mistakes.

## Fix plan (built into version 1 unless marked)

| fix | for | size | status |
| --- | --- | --- | --- |
| **Native app, not a web wrapper**; cached tree and file lists; a clear Arabic message instead of a web error | hate #1, #2 | L | ✅ built |
| **Every opened PDF stays on the phone** (re-downloaded automatically when you replace it on the site), plus a "keep forever" pin and a storage cap | hate #2, #3, ask #2, unsolved: weak data, exam night | M | ✅ built |
| **Resume where you stopped** + "continue reading" on home, staying inside the subject | hate #1 ("يطلعني من الماده"), ask #4 | S | ✅ built |
| **Reader**: zoom up to 5×, fit-width, jump to page, page counter | ask #4 | S | ✅ built |
| **Report a problem** from the reader (with the page number) → wp-admin "البلاغات"; fixes on the site reach the app automatically | hate #4, #6, unsolved: trust | S | ✅ built |
| **Ads you control**: banner never over the book; full-screen ad at most every N opens and M seconds apart; content rating G + child-directed by default; ads collapse instead of leaving gaps | hate #5, #7 | S | ✅ built |
| **No subscriptions, no carrier billing** | hate #8 | — | ✅ by design |
| **Content health screen** shows which subjects have no files or used the fallback | hate #6 | S | ✅ built |
| **Dark mode** | ask #5 | S | ✅ built |
| **"Short answer" files**: a site-side content decision (e.g. a "حل مختصر" post per subject, which gets its own badge in the app automatically) | ask #1 | M (content) | ⏳ your content team |
| **Interactive quizzes** from your existing Quiz and Survey Master plugin | ask #3 | M | ⏳ version 2 |

## Positioning angle

Three options, each grounded in the evidence:

1. **"يفتح دائماً، حتى بدون إنترنت"** (it always opens, even offline). *For students who lost their book the night before an exam because the app said "صفحة الويب غير متاحة".* Evidence: reliability is the top complaint (63 + 19 + 21 reviews).
2. **"كتب وحلول بدون إزعاج"** (books and solutions without the hassle). *For students tired of unskippable, inappropriate ads.* Evidence: 23 reviews.
3. **"بلّغ عن الخطأ ويُصحَّح"** (report a mistake and it gets fixed). *For students who don't trust the answers.* Evidence: 28 reviews.

**Recommended: #1**, backed by #2 in the store description. It is the biggest pain, it is the hardest for a web-wrapper competitor to copy, and it fits Sudan, where connections are often weak.
Don't mention واجباتي by name in the listing or ads.
