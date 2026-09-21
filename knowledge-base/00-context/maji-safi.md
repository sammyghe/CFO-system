# Maji Safi — company context

**Legal entity:** Safiflow Ventures Group Limited
**Trading as:** Maji Safi
**Site:** Lukuli Road, Buziga, Makindye Division, Kampala, Uganda
**Founder:** Samuel Ghedamu (Sammy)
**Status as at 21 Sep 2026:** pre-trading. Plant in place, no commercial trading begun.

## The business

Purified drinking water. A centralised ultrafiltration plant sells 20L refill and
single-use water into shops, institutions and households in Makindye.

## How the money works — the rules that govern everything

These are not preferences. They are the accounting rules the Year-1 model is built on, and
getting one wrong changes the statements.

1. **Revenue is stated NET of VAT and excise** (IFRS 15). Those are collected for the
   Uganda Revenue Authority and are never Maji Safi's revenue. Gross billings appear as a
   memo line only. Year 1: 2,548,482,759 gross billings, 740,623,047 of VAT+excise (29.1%
   of billings), 1,807,859,712 net revenue.
2. **The 20L reusable jar is a DEPOSIT, never revenue.**
   - Deposit received is a **liability** — no revenue, no VAT, no excise on receipt.
   - Jar cost of 11,000 UGX is **expensed in full on issue**, not capitalised. The deposit
     money buys the next jars: it is working capital, not profit.
   - Input VAT on the jar purchase **is** recovered (75% assumption).
   - Water in a reusable jar is **always** sold as a refill, including the first fill. Only
     single-use products are a full product sale.
   - **A deposit is never discounted** and carries no volume ladder.
3. **Two price books, decided by one question: who moves the water?**
   - **B2B** has a LIST price (the normal business price) and a FLOOR, earned on volume
     actually taken last month — **never given for a promise**.
   - **B2C** is one clear price with no discount.

## Year-1 headline numbers (forecast — see the drawback register)

| | |
|---|---|
| Net revenue | 1,807,859,712 UGX |
| Gross profit | 617,495,259 (34.2%) |
| EBITDA | 387,890,342 (21.5%) |
| Net profit | 227,423,239 (12.6%) |
| Pre-tax margin | 18.0% |
| Lowest cash point | **17,548,449** (Month 1) |
| Closing cash | 444,665,391 — of which **157,038,750 is customers' deposits** |
| Cash genuinely the company's | 287,626,641 |
| Month-1 result | **loss of 3,708,107** |
| Plant at cost | 315,000,000 · depreciation 63,000,000/yr |
| Debt | none — self-funded |

Break-even (Month 1, including the jar programme): **cash 452 jars/day, full 577 jars/day**
against a plan of 500/day. By Month 12, 2,000/day against 649/day.

## Source of truth

`majisafiyearone.xlsx` in Google Drive — "Maji Safi — Year One Financials & Plans",
prepared 8 September 2026 for the Renew Capital CFO100 pass. Twelve tabs: Cover, P&L,
Balance Sheet, Cash Flow, Break-Even, Taxes, Key Ratios, Common-Size, Pricing — Two Books,
B2B Volume Ladder, Team & Hiring Plan, CFO 90-Day Plan.

The workbook is **generated, not typed** — every number traces to `build_statements.py`
reading `models/Maji_Safi_One_Site_Simple.xlsx`. It does **not** recompute live; hand-editing
a cell does not ripple through. See drawback D-17.

Opening equity of 324,112,500 is **derived** (opening cash 4,000,000 + opening stock
5,112,500 + plant 315,000,000), not the real cap table. Actual share capital, investor terms
and valuation live outside this repository.

## How Sammy works — notes for future sessions

- Wants the honest version first. Asked for drawbacks before anything constructive got built.
- Works from generated, traceable artefacts rather than hand-typed spreadsheets — the
  workbook refuses hand edits by design.
- Records open questions as flags rather than filling them with invented numbers (the Cover
  tab's "WHAT IS STILL OPEN" section, the unapproved ladder bands).
- Dates and attributes decisions to a person (see `decisions-log.md`).
