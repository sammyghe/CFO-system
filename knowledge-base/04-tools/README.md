# 04-tools/ — superseded

The tools now live in **`models/`** at the repo root, as real workbooks:

- `MajiSafi_OneSite_Model.xlsx` — the live one-site model. Tabs: README, ASSUMPTIONS, P&L,
  BALANCE SHEET, CASH FLOW, BREAK-EVEN, **13-WEEK CASH**, **13-MONTH CASH**, RATIOS, CHECKS.
  The 13-week tab is Bragg priority #1 and the Monday standing rule. The 13-month tab is
  built in Renew's Session 5 shape.
- `MajiSafi_OneSite_BLANK.xlsx` — the same structure, empty, every line item labelled.
- `build_model.py` — regenerates both. Change the generator, not the workbook.

Still not built: a downside/base/upside scenario *page*. The single scenario multiplier on
ASSUMPTIONS covers the volume case already (drawback D-02 is partly closed).
