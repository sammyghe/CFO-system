import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as gcl
from openpyxl.worksheet.datavalidation import DataValidation

# ---- forecast budget, from majisafiyearone.xlsx (Year 1 = Oct-26 .. Sep-27) ----
NET  = [71515659,88697546,104744328,119797947,133993782,147461023,160323021,172697614,184697433,196430183,207998913,219502263]
COGS = [50496944,61962807,72074723,80890265,88464342,94849354,100095332,104250071,107359255,109466568,110613809,110840984]
VATX = [26140341,32950103,39609883,46142454,52569535,58911850,65189190,71420459,77623726,83816270,90014624,96234612]
SAL  = [2575000]*4 + [13575000]*8
TXN  = [488280,608238,721771,829702,932817,1031864,1127561,1220590,1311606,1401232,1490068,1578684]
JARC, FIXED, DEPM = 8250000, 8163542, 5250000
MONTHS = ["Oct-26","Nov-26","Dec-26","Jan-27","Feb-27","Mar-27","Apr-27","May-27","Jun-27","Jul-27","Aug-27","Sep-27"]

NAVY="FF1F3864"; BLUE="FFDDEBF7"; YEL="FFFFF2CC"; GREY="FFF2F2F2"; WARN="FFFDE9D9"; GREEN="FFE2EFDA"
H1=Font(bold=True,size=15,color=NAVY); H2=Font(bold=True,size=11,color="FFFFFFFF")
B=Font(bold=True); I=Font(italic=True,size=9,color="FF808080"); WHITEB=Font(bold=True,color="FFFFFFFF")
NUM='#,##0;[Red]-#,##0'; PCT='0.0%'; DEC='#,##0.00'
thin=Side(style='thin',color="FFD0D0D0"); BOX=Border(bottom=thin)

wb=openpyxl.Workbook()

def sect(ws,r,title,width=14):
    ws.cell(r,1,title).font=H2
    for c in range(1,width+1): ws.cell(r,c).fill=PatternFill("solid",fgColor=NAVY)
    return r+1
def note(ws,r,t):
    ws.cell(r,1,t).font=I; return r+1
def widths(ws,a=44,b=20,n=12,w=15,start=3):
    ws.column_dimensions['A'].width=a; ws.column_dimensions['B'].width=b
    for i in range(n): ws.column_dimensions[gcl(start+i)].width=w
    ws.freeze_panes=f"{gcl(start)}1"
def mhdr(ws,r,start=3,total=True):
    for i,m in enumerate(MONTHS):
        c=ws.cell(r,start+i,m); c.font=B; c.alignment=Alignment(horizontal="center"); c.border=BOX
    if total:
        c=ws.cell(r,start+12,"FY1 TOTAL"); c.font=B; c.alignment=Alignment(horizontal="center"); c.border=BOX
    return r+1

# ============ 1. START HERE ============
ws=wb.active; ws.title="START HERE"; ws.column_dimensions['A'].width=112
rows=[("MAJI SAFI — FINANCIAL SOURCE OF TRUTH",H1),
("Safiflow Ventures Group Limited, t/a Maji Safi · Lukuli Road, Buziga, Kampala",None),
("Financial year 1: 1 October 2026 – 30 September 2027",B),("",None),
("THIS IS THE ONLY FINANCIAL FILE.",B),
("If a number is not in here, it is not a number. No side spreadsheets, no second version,",None),
("no 'the one on my laptop'. One file, one truth. Everything else is a view OF this file.",None),("",None),
("HOW IT IS BUILT — four layers",B),
("  LAYER 1  INPUT     You type here and nowhere else:",None),
("                     SETUP · CHART OF ACCOUNTS · COST BOOK · PRICE BOOK · JOURNAL · PAYROLL",None),
("  LAYER 2  ENGINE    Never touched. Computes everything: MONTHLY · P&L · BALANCE SHEET · TvA",None),
("  LAYER 3  VIEWS     One per audience. Read-only. Nobody edits a view:",None),
("                     CO-FOUNDERS · INVESTORS · INTERNAL · TAX (URA) · LENDERS · GROWTH",None),
("  LAYER 4  CONTROL   CASH 13-WEEK · ACCESS · GAPS · CHECKS",None),("",None),
("THE DAILY JOB",B),
("Every transaction goes in JOURNAL as a double entry. That is the whole data-entry job.",None),
("Everything above it computes. If JOURNAL is right, every view is right.",None),("",None),
("THE STANDING RULE",B),
("Every Monday morning once we are selling: roll CASH 13-WEEK forward and read the ALARM row.",None),("",None),
("WHY DOUBLE ENTRY AND ACCOUNT CODES — this is the migration path",B),
("JOURNAL is a flat table with account codes, dates, debits and credits. That is exactly what",None),
("Xero, QuickBooks, Zoho and Odoo import. When we outgrow Sheets we export JOURNAL and",None),
("CHART OF ACCOUNTS as CSV and import them. No re-keying, no lost history.",None),
("Do NOT invent account names in JOURNAL. Pick a code from CHART OF ACCOUNTS or add one there",None),
("first. The moment two people call the same thing different names, migration breaks.",None),("",None),
("THE RULES THAT GOVERN THE NUMBERS",B),
("1. Revenue is NET of VAT and excise. Those are collected for URA and are never our revenue.",None),
("2. The 20L jar is a DEPOSIT, never revenue. A liability, repayable when the jar comes back.",None),
("3. The jar cost is expensed in full on issue, not capitalised.",None),
("4. Water in a reusable jar is always a refill, including the first fill.",None),
("5. B2B list and floor. Floor is EARNED on last month's volume, never given for a promise.",None),
("6. B2C is one price, no discount. A deposit is never discounted.",None),("",None),
("WHO RUNS IT AND WHO SEES IT → see the ACCESS tab.",B),
("WHAT WE STILL DO NOT KNOW → see the GAPS tab. Nothing in here is guessed silently.",B)]
r=1
for t,f in rows:
    c=ws.cell(r,1,t)
    if f: c.font=f
    r+=1

# ============ 2. SETUP ============
ws=wb.create_sheet("SETUP"); ws.column_dimensions['A'].width=48; ws.column_dimensions['B'].width=30; ws.column_dimensions['C'].width=52
ws.cell(1,1,"SETUP").font=H1
ws.cell(2,1,"Blue = you fill it in. This drives dates, tax and opening balances everywhere else.").font=I
r=4
def setrow(label,val,fmt='General',nt=""):
    global r
    ws.cell(r,1,label); c=ws.cell(r,2,val); c.number_format=fmt
    c.fill=PatternFill("solid",fgColor=BLUE); ws.cell(r,3,nt).font=I
    rr=r; r+=1; return rr
r=sect(ws,r,"COMPANY",3)
setrow("Registered name","Safiflow Ventures Group Limited")
setrow("Trading as","Maji Safi")
setrow("Site","Lukuli Road, Buziga, Makindye, Kampala")
r_fy=setrow("FY1 start date","2026-10-01",'yyyy-mm-dd',"First day of trading. Everything keys off this.")
r+=1
r=sect(ws,r,"TAX REGISTRATION — see GAPS, several unconfirmed",3)
r_tin=setrow("URA TIN",None,'General',"GAP-01")
r_vat=setrow("VAT registered? (YES/NO)",None,'General',"GAP-02 — changes whether output VAT is charged from day 1")
setrow("VAT effective date",None,'yyyy-mm-dd',"GAP-02")
r_vatr=setrow("VAT rate",0.18,PCT,"Standard rate")
r_inpv=setrow("Input VAT recovery assumption",0.75,PCT,"Model assumes 75%. Earned by chasing EFRIS invoices.")
r_efris=setrow("EFRIS enrolled? (YES/NO)",None,'General',"GAP-03 — the 75% above depends on this")
setrow("Excise — ad valorem rate",0.10,PCT,"Law: the HIGHER of this or the specific rate")
setrow("Excise — specific rate (UGX/litre)",50,'#,##0',"On a 20L jar the specific rate usually wins")
setrow("Digital tax stamp (UGX/unit)",15,'#,##0',"All products, refills included")
r_ctax=setrow("Corporate income tax rate",0.30,PCT,"Losses carried forward. Accrues monthly, PAID QUARTERLY.")
r_nssf_e=setrow("NSSF employee rate",0.05,PCT)
r_nssf_r=setrow("NSSF EMPLOYER rate",None,PCT,"GAP-04 — model records 5%, statutory is 10%. CONFIRM.")
r_lst=setrow("Local Service Tax (KCCA) — in model?","NO",'General',"GAP-05 — absent entirely. Needs adding.")
setrow("Trading licence (KCCA, per year)",600000,NUM)
setrow("UNBS certification status",None,'General',"GAP-06 — a delay pushes the whole ramp right")
r+=1
r=sect(ws,r,"OPENING BALANCES AT 1 OCTOBER 2026 — count them, do not estimate",3)
r_ocash=setrow("Opening cash — bank",None,NUM,"GAP-07 — actual statement balance at 30 Sep")
setrow("Opening cash — mobile money",None,NUM,"GAP-07")
setrow("Opening cash — petty cash",None,NUM,"GAP-07")
r_oinv=setrow("Opening inventory (counted)",None,NUM,"GAP-08 — physical count, not the model's 5,112,500")
setrow("Jars already in the field at 1 Oct",None,'#,##0',"GAP-09")
setrow("Deposits already collected at 1 Oct",None,NUM,"GAP-09 — this is a liability from day one")
setrow("Trade receivables at 1 Oct",None,NUM,"GAP-10")
setrow("Trade payables at 1 Oct",None,NUM,"GAP-10")
setrow("Loans outstanding at 1 Oct",None,NUM,"GAP-10")
r_plant=setrow("Plant and equipment at cost",315000000,NUM,"From the model")
r_life=setrow("Depreciation life (months)",60,'#,##0',"5 years. CONFIRM against supplier life — GAP-11")
r+=1
r=sect(ws,r,"POLICY",3)
r_floor=setrow("MINIMUM CASH FLOOR",20000000,NUM,"Below this, the alarm fires and something gets cut")
setrow("Variance investigation threshold — %",0.05,PCT,"Investigate any line >5% AND > the amount below")
setrow("Variance investigation threshold — UGX",2000000,NUM,"Renew gives no rule. This one is ours.")
setrow("Monthly close deadline","10th",'General',"Renew: 'Close on the 10th!'")
setrow("Monthly report to readers","15th",'General',"One page, LEAD format, same day every month")
S=lambda rr: f"SETUP!$B${rr}"

# ============ 3. CHART OF ACCOUNTS ============
ws=wb.create_sheet("CHART OF ACCOUNTS")
for col,w in zip("ABCDEF",[12,46,16,20,14,44]): ws.column_dimensions[col].width=w
ws.cell(1,1,"CHART OF ACCOUNTS").font=H1
ws.cell(2,1,"The controlled vocabulary. Add a line HERE before using it in JOURNAL. This is what migrates to Xero/QuickBooks.").font=I
r=4
for i,h in enumerate(["Code","Account name","Class","Statement","VAT code","Notes"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
COA=[
("1000","Cash — bank","Asset","Balance Sheet","N/A",""),
("1010","Cash — mobile money","Asset","Balance Sheet","N/A","MTN / Airtel merchant"),
("1020","Cash — petty cash","Asset","Balance Sheet","N/A",""),
("1100","Trade receivables","Asset","Balance Sheet","N/A","Zero in the plan. Will not stay zero."),
("1200","Inventory — preforms and bottles","Asset","Balance Sheet","Std",""),
("1210","Inventory — caps and labels","Asset","Balance Sheet","Std",""),
("1220","Inventory — jars held for issue","Asset","Balance Sheet","Std",""),
("1230","Inventory — treatment consumables","Asset","Balance Sheet","Std","Membranes, filters, chemicals"),
("1300","Input VAT recoverable","Asset","Balance Sheet","N/A","The 75%/90% recovery lives here"),
("1500","Plant and equipment at cost","Asset","Balance Sheet","Std",""),
("1510","Accumulated depreciation","Asset","Balance Sheet","N/A","Contra-asset"),
("2000","Trade payables","Liability","Balance Sheet","N/A","Zero in the plan"),
("2100","CUSTOMER DEPOSITS — refundable","Liability","Balance Sheet","N/A","NOT revenue. Our largest liability."),
("2200","Output VAT payable","Liability","Balance Sheet","N/A","Collected for URA"),
("2210","Excise duty payable","Liability","Balance Sheet","N/A","Collected for URA"),
("2220","Digital tax stamps payable","Liability","Balance Sheet","N/A",""),
("2300","PAYE payable","Liability","Balance Sheet","N/A","Withheld from wages"),
("2310","NSSF payable","Liability","Balance Sheet","N/A","Employee + employer"),
("2320","Local Service Tax payable","Liability","Balance Sheet","N/A","GAP-05 — not yet modelled"),
("2400","Corporate tax payable","Liability","Balance Sheet","N/A","Accrues monthly, paid quarterly"),
("2500","Loans and borrowings","Liability","Balance Sheet","N/A","None today"),
("3000","Share capital","Equity","Balance Sheet","N/A","GAP-12 — real cap table unknown"),
("3100","Retained earnings","Equity","Balance Sheet","N/A",""),
("4000","Revenue — 20L refill","Revenue","P&L","Std","NET of VAT and excise"),
("4010","Revenue — 20L single-use","Revenue","P&L","Std",""),
("4020","Revenue — 5L single-use","Revenue","P&L","Std",""),
("4100","Revenue — delivery charges","Revenue","P&L","Std","If charged separately"),
("5000","COGS — preforms and bottles","Cost of sales","P&L","Std","GAP-13 — need the bill of materials"),
("5010","COGS — caps, labels, shrink wrap","Cost of sales","P&L","Std","GAP-13"),
("5020","COGS — treatment chemicals","Cost of sales","P&L","Std","GAP-13"),
("5030","COGS — membranes and filters","Cost of sales","P&L","Std","GAP-13 + GAP-11"),
("5040","COGS — plant electricity and water","Cost of sales","P&L","Std","GAP-13"),
("5050","COGS — digital tax stamps","Cost of sales","P&L","N/A","15 UGX per unit"),
("5100","JAR COST expensed on issue","Cost of sales","P&L","Std","11,000/jar. Expensed, never capitalised."),
("5200","Delivery and logistics","Cost of sales","P&L","Std","GAP-14 — own vehicles or hired?"),
("6000","Salaries and wages","Operating cost","P&L","N/A","GAP-15 — need the headcount register"),
("6010","NSSF — employer contribution","Operating cost","P&L","N/A","GAP-04"),
("6100","Rent","Operating cost","P&L","Std","GAP-16 — part of the 8,163,542 blend"),
("6110","Electricity and water — premises","Operating cost","P&L","Std","GAP-16"),
("6120","Security","Operating cost","P&L","Std","GAP-16"),
("6130","Internet, airtime and software","Operating cost","P&L","Std","GAP-16"),
("6140","Insurance","Operating cost","P&L","Std","~150,000/mo estimate. Get the real policy."),
("6150","Repairs and maintenance","Operating cost","P&L","Std","GAP-16"),
("6160","Cleaning and sanitation","Operating cost","P&L","Std","GAP-16"),
("6170","Trading licence and statutory fees","Operating cost","P&L","N/A","600,000/yr KCCA"),
("6180","Professional fees","Operating cost","P&L","Std","Auditor, tax advisor — GAP-17"),
("6190","Marketing and customer acquisition","Operating cost","P&L","Std","GAP-18 — CAC is not modelled at all"),
("6200","Transaction and bank fees","Operating cost","P&L","N/A","0.5% of gross billings"),
("6210","Other operating costs","Operating cost","P&L","Std","Keep this small. If it grows, split it."),
("7000","Depreciation","Operating cost","P&L","N/A","Non-cash"),
("8000","Corporate income tax","Tax","P&L","N/A","30% of taxable profit"),
("9000","Bad debt provision","Operating cost","P&L","N/A","Zero today. Will not stay zero."),
]
first_coa=r
for row in COA:
    for i,v in enumerate(row): ws.cell(r,1+i,v)
    if row[2] in ("Revenue",): ws.cell(r,1).fill=PatternFill("solid",fgColor=GREEN)
    if "GAP-" in row[5]: ws.cell(r,6).fill=PatternFill("solid",fgColor=WARN)
    r+=1
last_coa=r-1
ws.freeze_panes="A5"


# ============ 4. COST BOOK ============
ws=wb.create_sheet("COST BOOK")
for col,w in zip("ABCDEFG",[12,44,20,18,16,18,44]): ws.column_dimensions[col].width=w
ws.cell(1,1,"COST BOOK — every cost we have, and what we do not yet know").font=H1
ws.cell(2,1,"What we know comes from the Year-1 model. What we do not know is marked NEEDS BREAKDOWN and carried to GAPS. Nothing here is invented.").font=I
r=4
for i,h in enumerate(["Code","Cost line","Category","FY1 amount (UGX)","Basis","Owner","Status / what is missing"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
COSTS=[
("5000-5050","Cost of sales — all materials and plant inputs","Cost of sales",sum(COGS),"Per unit: 3,884 in M1 falling to 2,132 by M12","Sammy","NEEDS BREAKDOWN — one blended number. Need the bill of materials per SKU: preforms, caps, labels, shrink, chemicals, membranes, plant power, water."),
("5100","Jar cost expensed on issue","Cost of sales",JARC*12,"750 jars x 11,000 per month","Sammy","KNOWN and firm"),
("5200","Delivery and logistics","Cost of sales",None,"Unknown","Sammy","MISSING — is delivery inside the COGS blend or not budgeted at all? Own vehicles or hired? Fuel, driver, maintenance?"),
("6000","Salaries and wages","Operating",sum(SAL),"2,575,000/mo, stepping to 13,575,000 at month 5","Sammy","NEEDS BREAKDOWN — how many heads at each step, which roles, which are production vs admin?"),
("6010","NSSF employer contribution","Operating",None,"5% recorded; statutory 10%","Sammy","UNDERSTATED — confirm the rate, then this line roughly doubles"),
("6100-6210","Fixed operating costs — all overheads","Operating",FIXED*12,"8,163,542 per month, flat","Sammy","NEEDS BREAKDOWN — one blended number covering rent, power, security, internet, insurance, repairs, cleaning, licence, professional fees. We know only two pieces: licence 600,000/yr and insurance approx 150,000/mo."),
("6190","Marketing and customer acquisition","Operating",None,"Not in the model","Sammy","MISSING ENTIRELY — the plan acquires 750 new jar customers every month with zero acquisition cost. That cannot be right."),
("6200","Transaction and bank fees","Operating",sum(TXN),"0.5% of gross billings","Sammy","KNOWN"),
("7000","Depreciation","Operating",DEPM*12,"315,000,000 over 60 months","Sammy","KNOWN — but confirm the 5-year life and add membrane replacement"),
("5030","Membrane and filter replacement","Cost of sales",None,"Not in the model","Sammy","MISSING — zero maintenance capex and zero consumables replacement in a full year of running 2,000 jars/day"),
("8000","Corporate income tax","Tax",97467102,"30% of taxable profit, paid quarterly","Sammy","KNOWN"),
("2200-2220","VAT, excise and digital stamps","Collected for URA",sum(VATX),"29.1% of gross billings","Sammy","KNOWN — and never ours"),
("2320","Local Service Tax","Tax",None,"KCCA, on employees","Sammy","MISSING ENTIRELY from the model"),
("6170","Trading licence","Operating",600000,"KCCA per year","Sammy","KNOWN"),
("9000","Bad debt provision","Operating",None,"Zero — every sale is cash","Sammy","NOT PROVIDED — fine while DSO is 0. The first institution on 30 days changes that."),
("2100","Jar deposit REFUNDS","Balance sheet",None,"Zero returns assumed","Sammy","MISSING — no return rate, no refund reserve, no forfeiture policy"),
]
for row in COSTS:
    ws.cell(r,1,row[0]); ws.cell(r,2,row[1]); ws.cell(r,3,row[2])
    c=ws.cell(r,4,row[3]); c.number_format=NUM
    ws.cell(r,5,row[4]).font=I; ws.cell(r,6,row[5]); ws.cell(r,7,row[6])
    st=row[6]
    if st.startswith(("NEEDS","MISSING","UNDERSTATED","NOT PROV")):
        ws.cell(r,7).fill=PatternFill("solid",fgColor=WARN); ws.cell(r,4).fill=PatternFill("solid",fgColor=WARN)
    else:
        ws.cell(r,7).fill=PatternFill("solid",fgColor=GREEN)
    r+=1
r+=1
ws.cell(r,2,"TOTAL COSTS WE CAN NAME (FY1)").font=B
c=ws.cell(r,4,f"=SUM(D5:D{r-2})"); c.number_format=NUM; c.font=B
r+=2
for tx in ["Six lines above have no number at all. Four more are single blended figures hiding many lines.",
           "Until those are broken out we do not actually know our costs — we know our cost TOTAL, which is not the same thing.",
           "Renew Session 3: a gap on its own is not a finding. The reason behind it is. You cannot find a reason inside a blended number."]:
    ws.cell(r,2,tx).font=I; r+=1
ws.freeze_panes="A5"

# ============ 5. PRICE BOOK ============
ws=wb.create_sheet("PRICE BOOK")
for col,w in zip("ABCDEF",[36,18,18,18,20,40]): ws.column_dimensions[col].width=w
ws.cell(1,1,"PRICE BOOK — two books, decided by one question: who moves the water?").font=H1
r=3
for i,h in enumerate(["Product","B2B floor","B2B list","B2C","Status","Notes"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
for row in [("20L Refill",3300,5000,6000,"ANCHORS SET","Sammy, 8 Sep 2026"),
            ("20L Single-Use",9000,10050,10350,"ANCHORS SET",""),
            ("5L Single-Use",3450,4500,4800,"ANCHORS SET",""),
            ("20L Reusable Jar (DEPOSIT)",16800,17850,18150,"NEVER DISCOUNTED","A liability, not revenue")]:
    ws.cell(r,1,row[0])
    for i in (1,2,3): ws.cell(r,1+i,row[i]).number_format=NUM
    ws.cell(r,5,row[4]).font=B; ws.cell(r,6,row[5]).font=I; r+=1
r+=1
ws.cell(r,1,"B2B VOLUME LADDER — tier set from LAST MONTH'S ACHIEVED volume, never a promise").font=B; r+=1
for i,h in enumerate(["Achieved last month","20L Refill","20L Single-Use","5L","Status",""]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
for row in [("List (base)",5000,10050,4500,"APPROVED — Sammy 8 Sep"),
            ("500+",4400,9700,4150,"NOT APPROVED — GAP-19"),
            ("1,500+",3800,9350,3800,"NOT APPROVED — GAP-19"),
            ("3,000+ (FLOOR)",3300,9000,3450,"APPROVED — never below")]:
    ws.cell(r,1,row[0])
    for i in (1,2,3): ws.cell(r,1+i,row[i]).number_format=NUM
    c=ws.cell(r,5,row[4]); c.font=B
    if "NOT APPROVED" in row[4]: c.fill=PatternFill("solid",fgColor=WARN)
    r+=1
r+=1
ws.cell(r,1,"Half this ladder is still unapproved, so part of our revenue mix is assumption. And 'the floor is earned' is a sentence, not a control — nothing stops someone granting it in the moment.").font=I

# ============ 6. JOURNAL ============
ws=wb.create_sheet("JOURNAL")
hdrs=["Date","Ref","Account code","Account name","Description","Counterparty","Channel","Product","Debit","Credit","VAT code","Source doc","Entered by"]
for col,w in zip("ABCDEFGHIJKLM",[12,12,14,34,40,24,12,16,16,16,10,18,14]): ws.column_dimensions[col].width=w
ws.cell(1,1,"JOURNAL — every transaction, double entry. This is the whole data-entry job.").font=H1
ws.cell(2,1,"One row per side. Debits equal credits. Pick the account code from CHART OF ACCOUNTS — never type a new name here.").font=I
r=4
for i,h in enumerate(hdrs):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
JHDR=r; JFIRST=r+1; JLAST=JFIRST+499
for rr in range(JFIRST,JLAST+1):
    ws.cell(rr,4,f'=IFERROR(VLOOKUP($C{rr},\'CHART OF ACCOUNTS\'!$A:$B,2,FALSE),"")')
    ws.cell(rr,1).number_format='yyyy-mm-dd'
    for cc in (9,10): ws.cell(rr,cc).number_format=NUM
    for cc in (1,2,3,5,6,7,8,9,10,11,12,13):
        ws.cell(rr,cc).fill=PatternFill("solid",fgColor=BLUE)
dv=DataValidation(type="list",formula1=f"='CHART OF ACCOUNTS'!$A${first_coa}:$A${last_coa}",allow_blank=True)
ws.add_data_validation(dv); dv.add(f"C{JFIRST}:C{JLAST}")
dv2=DataValidation(type="list",formula1='"B2B,B2C,Institution,Other"',allow_blank=True)
ws.add_data_validation(dv2); dv2.add(f"G{JFIRST}:G{JLAST}")
dv3=DataValidation(type="list",formula1='"20L Refill,20L Single-Use,5L Single-Use,Jar Deposit,N/A"',allow_blank=True)
ws.add_data_validation(dv3); dv3.add(f"H{JFIRST}:H{JLAST}")
ws.freeze_panes="A5"

# ============ 7. MONTHLY (engine) ============
ws=wb.create_sheet("MONTHLY"); widths(ws,14,44,12,15,start=3)
ws.cell(1,1,"MONTHLY — engine. Never type here.").font=H1
ws.cell(2,1,"Net movement per account per month, built from JOURNAL with SUMIFS. Debit positive, credit negative.").font=I
r=4
ws.cell(r,1,"Code").font=B; ws.cell(r,2,"Account").font=B
r=mhdr(ws,r)
MFIRST=r
for idx,(code,name,cls,stmt,vat,nt) in enumerate(COA):
    rr=r+idx
    ws.cell(rr,1,code); ws.cell(rr,2,name)
    for i in range(12):
        ms=f"DATE(YEAR({S(r_fy)}),MONTH({S(r_fy)})+{i},1)"
        me=f"EOMONTH({S(r_fy)},{i})"
        f=(f"=SUMIFS(JOURNAL!$I${JFIRST}:$I${JLAST},JOURNAL!$C${JFIRST}:$C${JLAST},$A{rr},"
           f"JOURNAL!$A${JFIRST}:$A${JLAST},\">=\"&{ms},JOURNAL!$A${JFIRST}:$A${JLAST},\"<=\"&{me})"
           f"-SUMIFS(JOURNAL!$J${JFIRST}:$J${JLAST},JOURNAL!$C${JFIRST}:$C${JLAST},$A{rr},"
           f"JOURNAL!$A${JFIRST}:$A${JLAST},\">=\"&{ms},JOURNAL!$A${JFIRST}:$A${JLAST},\"<=\"&{me})")
        c=ws.cell(rr,3+i,f); c.number_format=NUM
    c=ws.cell(rr,15,f"=SUM(C{rr}:N{rr})"); c.number_format=NUM; c.font=B
MLAST=r+len(COA)-1
M={code:MFIRST+i for i,(code,*_ ) in enumerate(COA)}
r=MLAST+2
ws.cell(r,2,"CHECK — journal must balance (debits = credits)").font=B
c=ws.cell(r,3,f"=ROUND(SUM(JOURNAL!$I${JFIRST}:$I${JLAST})-SUM(JOURNAL!$J${JFIRST}:$J${JLAST}),0)")
c.number_format=NUM; c.font=B; c.fill=PatternFill("solid",fgColor=WARN)
ws.cell(r,4,"Must be zero. If it is not, a journal entry is one-sided.").font=I
ws.freeze_panes="C5"
MCHK=r


def cls_rows(c):
    idx=[i for i,(code,name,k,*_ ) in enumerate(COA) if k==c]
    return MFIRST+idx[0], MFIRST+idx[-1]
REV=cls_rows("Revenue"); CGS=cls_rows("Cost of sales"); OPX=cls_rows("Operating cost")

# ============ 8. BUDGET ============
ws=wb.create_sheet("BUDGET"); widths(ws)
ws.cell(1,1,"BUDGET — FY1 plan. This is the TARGET half of Target vs Actuals.").font=H1
ws.cell(2,1,"From the Year-1 model, restated to Oct-26 start. This is what we said we would do. TvA compares it to what we actually did.").font=I
r=4; r=mhdr(ws,r)
def brow(label,vals,bold=False):
    global r
    ws.cell(r,1,label)
    if bold: ws.cell(r,1).font=B
    for i in range(12):
        c=ws.cell(r,3+i,vals[i]); c.number_format=NUM
        if bold: c.font=B
    c=ws.cell(r,15,f"=SUM(C{r}:N{r})"); c.number_format=NUM; c.font=B
    rr=r; r+=1; return rr
B_net=brow("NET REVENUE",NET,True)
B_cogs=brow("Cost of sales",COGS)
B_jar=brow("Jar cost expensed",[JARC]*12)
B_gp=brow("GROSS PROFIT",[NET[i]-COGS[i]-JARC for i in range(12)],True)
B_fix=brow("Fixed operating costs",[FIXED]*12)
B_sal=brow("Salaries and wages",SAL)
B_txn=brow("Transaction fees",TXN)
B_dep=brow("Depreciation",[DEPM]*12)
B_np=brow("NET PROFIT (pre-tax)",[NET[i]-COGS[i]-JARC-FIXED-SAL[i]-TXN[i]-DEPM for i in range(12)],True)
r+=1
ws.cell(r,1,"Budget is fixed once FY1 starts. You do not edit a target to match an actual — that is how a company lies to itself.").font=I

# ============ 9. P&L (actuals) ============
ws=wb.create_sheet("P&L"); widths(ws)
ws.cell(1,1,"PROFIT OR LOSS — ACTUAL").font=H1
ws.cell(2,1,"Built from JOURNAL. Revenue is stated NET of VAT and excise. Empty until trading starts 1 Oct 2026.").font=I
r=4; r=mhdr(ws,r)
def prow(label,f,bold=False,fill=None):
    global r
    ws.cell(r,1,label)
    if bold: ws.cell(r,1).font=B
    for i in range(12):
        c=ws.cell(r,3+i,f(gcl(3+i))); c.number_format=NUM
        if bold: c.font=B
        if fill: c.fill=PatternFill("solid",fgColor=fill)
    c=ws.cell(r,15,f"=SUM(C{r}:N{r})"); c.number_format=NUM; c.font=B
    rr=r; r+=1; return rr
P_net=prow("NET REVENUE",lambda c:f"=-SUM(MONTHLY!{c}{REV[0]}:{c}{REV[1]})",True)
P_cogs=prow("Cost of sales (incl jar cost)",lambda c:f"=SUM(MONTHLY!{c}{CGS[0]}:{c}{CGS[1]})")
P_gp=prow("GROSS PROFIT",lambda c:f"={c}{P_net}-{c}{P_cogs}",True)
P_opx=prow("Operating costs",lambda c:f"=SUM(MONTHLY!{c}{OPX[0]}:{c}{OPX[1]})")
P_ebit=prow("PROFIT BEFORE TAX",lambda c:f"={c}{P_gp}-{c}{P_opx}",True)
P_tax=prow("Corporate tax",lambda c:f"=MONTHLY!{c}{M['8000']}")
P_np=prow("NET PROFIT",lambda c:f"={c}{P_ebit}-{c}{P_tax}",True,GREY)
r+=1; r=mhdr(ws,r)
for lab,num in [("Gross margin",P_gp),("Pre-tax margin",P_ebit),("Net margin",P_np)]:
    ws.cell(r,1,lab)
    for i in range(12):
        c=gcl(3+i); cc=ws.cell(r,3+i,f'=IF({c}{P_net}=0,"",{c}{num}/{c}{P_net})'); cc.number_format=PCT
    cc=ws.cell(r,15,f'=IF(O{P_net}=0,"",O{num}/O{P_net})'); cc.number_format=PCT; cc.font=B
    r+=1

# ============ 10. TvA ============
ws=wb.create_sheet("TvA")
for col,w in zip("ABCDEFG",[40,18,18,18,14,16,56]): ws.column_dimensions[col].width=w
ws.cell(1,1,"TARGET vs ACTUALS — Bucket 1. The accountable CFO.").font=H1
ws.cell(2,1,'Ask "why" seven times. A gap on its own is not a finding — the reason behind it is.').font=I
r=4
ws.cell(r,1,"Reporting month (1 = Oct-26)").font=B
c=ws.cell(r,2,1); c.fill=PatternFill("solid",fgColor=YEL); c.font=B; c.number_format='#,##0'
TVM=r; r+=2
for i,h in enumerate(["Line","Actual","Target","Variance","Var %","Investigate?","WHY — the seventh answer"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
for lab,pl,bd in [("Net revenue",P_net,B_net),("Cost of sales",P_cogs,B_cogs),("Gross profit",P_gp,B_gp),
                  ("Operating costs",P_opx,B_fix),("Profit before tax",P_ebit,B_np)]:
    ws.cell(r,1,lab)
    ws.cell(r,2,f"=INDEX('P&L'!$C${pl}:$N${pl},$B${TVM})").number_format=NUM
    ws.cell(r,3,f"=INDEX(BUDGET!$C${bd}:$N${bd},$B${TVM})").number_format=NUM
    ws.cell(r,4,f"=B{r}-C{r}").number_format=NUM
    ws.cell(r,5,f'=IF(C{r}=0,"",D{r}/C{r})').number_format=PCT
    ws.cell(r,6,f'=IF(AND(ABS(D{r})>{S(r_floor)}*0+SETUP!$B${r_floor+2},ABS(IFERROR(D{r}/C{r},0))>SETUP!$B${r_floor+1}),"INVESTIGATE","ok")').font=B
    ws.cell(r,6).fill=PatternFill("solid",fgColor=WARN)
    ws.cell(r,7,"").fill=PatternFill("solid",fgColor=BLUE)
    r+=1
r+=1
for tx in ["Threshold is set in SETUP: investigate anything more than 5% AND more than 2,000,000 UGX off target.",
           "Renew gives no materiality rule. This one is ours, and it is better than no rule.",
           "The WHY column is not optional. A variance with a blank WHY is an unfinished month."]:
    ws.cell(r,1,tx).font=I; r+=1

# ============ 11. BALANCE SHEET ============
ws=wb.create_sheet("BALANCE SHEET"); widths(ws)
ws.cell(1,1,"STATEMENT OF FINANCIAL POSITION").font=H1
ws.cell(2,1,"Cumulative from JOURNAL. The CHECK row must read zero.").font=I
r=4; r=mhdr(ws,r,total=False)
def bsrow(label,codes,sign=1,bold=False,fill=None):
    global r
    ws.cell(r,1,label)
    if bold: ws.cell(r,1).font=B
    for i in range(12):
        c=gcl(3+i)
        parts="+".join(f"SUM(MONTHLY!$C${M[k]}:{c}{M[k]})" for k in codes)
        cc=ws.cell(r,3+i,f"={'-' if sign<0 else ''}({parts})"); cc.number_format=NUM
        if bold: cc.font=B
        if fill: cc.fill=PatternFill("solid",fgColor=fill)
    rr=r; r+=1; return rr
ws.cell(r,1,"ASSETS").font=B; r+=1
A_cash=bsrow("Cash (bank + mobile + petty)",["1000","1010","1020"])
A_rec=bsrow("Trade receivables",["1100"])
A_inv=bsrow("Inventory",["1200","1210","1220","1230"])
A_vat=bsrow("Input VAT recoverable",["1300"])
A_ppe=bsrow("Plant and equipment (net)",["1500","1510"])
A_tot=bsrow("TOTAL ASSETS",["1000","1010","1020","1100","1200","1210","1220","1230","1300","1500","1510"],1,True)
r+=1; ws.cell(r,1,"LIABILITIES").font=B; r+=1
L_pay=bsrow("Trade payables",["2000"],-1)
L_dep=bsrow("CUSTOMER DEPOSITS — refundable",["2100"],-1,True,WARN)
L_ura=bsrow("URA — VAT, excise, stamps",["2200","2210","2220"],-1)
L_pay2=bsrow("Payroll statutory (PAYE, NSSF, LST)",["2300","2310","2320"],-1)
L_ctax=bsrow("Corporate tax payable",["2400"],-1)
L_loan=bsrow("Loans and borrowings",["2500"],-1)
L_tot=bsrow("TOTAL LIABILITIES",["2000","2100","2200","2210","2220","2300","2310","2320","2400","2500"],-1,True)
r+=1; ws.cell(r,1,"EQUITY").font=B; r+=1
E_sc=bsrow("Share capital",["3000"],-1)
E_re=bsrow("Retained earnings",["3100"],-1)
for i in range(12):
    c=gcl(3+i)
    ws.cell(E_re,3+i, f"=-(SUM(MONTHLY!$C${M['3100']}:{c}{M['3100']}))+SUM('P&L'!$C${P_np}:{c}{P_np})")
ws.cell(E_re,1,"Retained earnings (incl. current-year profit)")
E_tot=r
ws.cell(r,1,"TOTAL EQUITY").font=B
for i in range(12):
    c=gcl(3+i)
    cc=ws.cell(r,3+i,f"={c}{E_sc}+{c}{E_re}"); cc.number_format=NUM; cc.font=B
r+=1
r+=1
ws.cell(r,1,"CHECK — must be zero").font=B
for i in range(12):
    c=gcl(3+i)
    cc=ws.cell(r,3+i,f"=ROUND({c}{A_tot}-{c}{L_tot}-{c}{E_tot},0)"); cc.number_format=NUM; cc.font=B
    cc.fill=PatternFill("solid",fgColor=WARN)
BCHK=r; r+=2
ws.cell(r,1,"CASH GENUINELY OURS").font=B
for i in range(12):
    c=gcl(3+i); cc=ws.cell(r,3+i,f"={c}{A_cash}-{c}{L_dep}"); cc.number_format=NUM; cc.font=B
    cc.fill=PatternFill("solid",fgColor=GREEN)
B_own=r; r+=1
ws.cell(r,1,"Cash less customer deposits. Manage to THIS line, never to the cash line.").font=I


def viewsheet(name,title,reader,grading,intro):
    ws=wb.create_sheet(name)
    for col,w in zip("ABCD",[52,24,24,60]): ws.column_dimensions[col].width=w
    ws.cell(1,1,title).font=H1
    ws.cell(2,1,f"READER: {reader}").font=B
    ws.cell(3,1,f'THEY ARE GRADING YOU ON: {grading}').font=I
    ws.cell(4,1,intro).font=I
    return ws,6
def kpi(ws,r,label,formula,fmt=NUM,note=""):
    ws.cell(r,1,label)
    c=ws.cell(r,2,formula); c.number_format=fmt; c.font=B
    ws.cell(r,4,note).font=I
    return r+1
def lead(ws,r,L,E,A,D):
    r=sect(ws,r,"THE MONTHLY MESSAGE — LEAD",4)
    for k,v in [("L — the finding",L),("E — the driver",E),("A — the amount",A),("D — the decision",D)]:
        ws.cell(r,1,k).font=B
        c=ws.cell(r,2,v); c.fill=PatternFill("solid",fgColor=BLUE)
        ws.merge_cells(start_row=r,start_column=2,end_row=r,end_column=4)
        r+=1
    return r+1
CUR="INDEX('P&L'!$C${}:$N${},TvA!$B$4)"
BSCUR="INDEX('BALANCE SHEET'!$C${}:$N${},TvA!$B$4)"

# ---- VIEW: CO-FOUNDERS ----
ws,r=viewsheet("VIEW · CO-FOUNDERS","CO-FOUNDERS","The people who carry the risk with you",
  "Honesty. They can handle bad news; they cannot handle finding out late.",
  "The unvarnished version. Everything that is wrong goes here first, before it goes anywhere else.")
r=sect(ws,r,"WHERE WE ACTUALLY STAND",4)
r=kpi(ws,r,"Cash in the bank",f"={BSCUR.format(A_cash,A_cash)}",NUM,"Includes money that is not ours")
r=kpi(ws,r,"Customer deposits we owe back",f"={BSCUR.format(L_dep,L_dep)}",NUM,"Repayable when a jar comes back")
r=kpi(ws,r,"CASH GENUINELY OURS",f"={BSCUR.format(B_own,B_own)}",NUM,"This is the real number. Manage to it.")
r=kpi(ws,r,"Months of cover at current burn",'=IFERROR(B8/MAX(1,-INDEX(\'P&L\'!$C$%d:$N$%d,TvA!$B$4)),"n/a")'%(P_np,P_np),'0.0',"Blank while profitable")
r=kpi(ws,r,"Profit before tax this month",f"={CUR.format(P_ebit,P_ebit)}")
r=kpi(ws,r,"Against target","=TvA!D12",NUM,"Variance on profit before tax")
r+=1
r=sect(ws,r,"THE THINGS WE ARE CARRYING",4)
for txt in ["No facility, no overdraft, no committed tranche behind the thinnest month.",
            "Half the B2B price ladder is still unapproved, so part of the revenue mix is assumption.",
            "We model zero jar returns. Every jar that comes back is cash out with no revenue against it.",
            "We model zero receivables. The first institution asking for 30 days changes the cash shape.",
            "NSSF employer is recorded at 5%; statutory is 10%. Local Service Tax is missing entirely.",
            "Finance is two founders wearing hats. Segregation of duties is arithmetically impossible."]:
    ws.cell(r,1,"•  "+txt); r+=1
r+=1
r=lead(ws,r,"[one sentence: what happened and what I recommend]","[the driver — the seventh answer, not the first]",
       "[the amount at stake, in UGX]","[what I need decided, and by when]")

# ---- VIEW: INVESTORS ----
ws,r=viewsheet("VIEW · INVESTORS","INVESTORS","Existing and prospective equity investors",
  '"Growth, and no surprises." — Renew CFO100 Session 4',
  "Growth trajectory, unit economics, and the risks named BEFORE they are asked about. Never let an investor discover a problem you knew about.")
r=sect(ws,r,"THE HEADLINE",4)
r=kpi(ws,r,"Net revenue — month",f"={CUR.format(P_net,P_net)}")
r=kpi(ws,r,"Net revenue — year to date",f"=SUM(OFFSET('P&L'!$C${P_net},0,0,1,TvA!$B$4))")
r=kpi(ws,r,"Gross margin",f'=IFERROR({CUR.format(P_gp,P_gp)}/{CUR.format(P_net,P_net)},"")',PCT,"Plan: 18% in M1 rising to 46% by M12")
r=kpi(ws,r,"Pre-tax margin",f'=IFERROR({CUR.format(P_ebit,P_ebit)}/{CUR.format(P_net,P_net)},"")',PCT,"Renew band: 5% life support, 10% floor, 15% healthy")
r=kpi(ws,r,"Revenue vs target",'=TvA!E8',PCT,"Bucket 1. The number they will ask about.")
r+=1
r=sect(ws,r,"UNIT ECONOMICS — the thing that actually decides this business",4)
r=kpi(ws,r,"Jars sold per day (month average)",None,'#,##0',"From JOURNAL once trading")
r=kpi(ws,r,"Full break-even, incl jar programme",577,'#,##0',"jars/day in month 1 — from the plan")
r=kpi(ws,r,"Headroom over break-even",None,'#,##0',"Negative means we are below break-even")
r=kpi(ws,r,"Contribution per unit",None,DEC,"Plan: 1,617 in M1 rising to 2,090 by M12")
r=kpi(ws,r,"Customer acquisition cost per jar customer",None,NUM,"GAP-18 — NOT MODELLED. They will ask.")
r+=1
r=sect(ws,r,"RISKS WE ARE NAMING OURSELVES",4)
for txt in ["Pre-revenue until 1 Oct 2026. Every ratio before that date is a forecast, not a result.",
            "Single site, single city. Any interruption is total, not partial.",
            "Customer deposits are our largest liability and are funded by growth.",
            "The volume ramp is not yet contracted. It is the assumption the whole plan rests on.",
            "No auditor appointed. Reviewed accounts are cheaper now than under a raise deadline."]:
    ws.cell(r,1,"•  "+txt); r+=1
r+=1
r=lead(ws,r,"[the finding — growth, and the one thing that could derail it]","[the driver]","[UGX, and what it means for the plan]","[what we are asking for, or 'nothing needed from you']")
ws.cell(r,1,'Renew: "Nothing needed from you" is a legitimate D line. Use it when it is true.').font=I

# ---- VIEW: INTERNAL ----
ws,r=viewsheet("VIEW · INTERNAL","INTERNAL — MANAGEMENT","Sammy and whoever runs the plant and the route",
  '"Accuracy, and can I use this Monday morning." — Renew CFO100 Session 4',
  "Operational. No ratios nobody acts on. Only numbers that change what someone does this week.")
r=sect(ws,r,"THIS WEEK",4)
r=kpi(ws,r,"Jars/day needed to break even (incl jar programme)",577,'#,##0',"The number everyone on site should know")
r=kpi(ws,r,"Jars/day actually produced",None,'#,##0',"")
r=kpi(ws,r,"Above / (below) break-even",None,'#,##0',"")
r=kpi(ws,r,"Cash at close of last week",None,NUM,"From CASH 13-WEEK")
r=kpi(ws,r,"Headroom over the minimum floor",None,NUM,"Negative = something gets cut this week")
r+=1
r=sect(ws,r,"MIX AND COST",4)
for lab in ["Volume — 20L refill","Volume — 20L single-use","Volume — 5L single-use","New jars issued","Jars returned"]:
    r=kpi(ws,r,lab,None,'#,##0',"From JOURNAL, by Product")
r=kpi(ws,r,"Cost of sales per unit",None,DEC,"Plan: 3,884 in M1 falling to 2,132 by M12")
r=kpi(ws,r,"Days of inventory on hand",None,'0.0',"Plan: about 3 days")
r+=1
r=sect(ws,r,"THE WEEKLY FLASH — one page, every week",4)
for txt in ["Expected month-end revenue","Expected month-end contribution","Expected month-end cash",
            "Anything that will miss, and what I am doing about it"]:
    ws.cell(r,1,"•  "+txt); ws.cell(r,2,"").fill=PatternFill("solid",fgColor=BLUE); r+=1

# ---- VIEW: TAX ----
ws,r=viewsheet("VIEW · TAX (URA)","TAX — URA","Uganda Revenue Authority, and our tax advisor",
  '"Is the format right and the number defensible." — Renew CFO100 Session 4',
  "Nothing persuasive here. Only what is owed, what was paid, and when it is due. Every figure must trace to a journal entry.")
r=sect(ws,r,"COLLECTED FOR URA — never our revenue",4)
r=kpi(ws,r,"Gross billings (VAT-inclusive)",None,NUM,"Memo line only")
r=kpi(ws,r,"Output VAT",f"=-{BSCUR.format(L_ura,L_ura)}*0+SUM(OFFSET(MONTHLY!$C${M['2200']},0,0,1,TvA!$B$4))*-1",NUM,"18%")
r=kpi(ws,r,"Excise duty",f"=SUM(OFFSET(MONTHLY!$C${M['2210']},0,0,1,TvA!$B$4))*-1",NUM,"Higher of 10% ad valorem or 50 UGX/litre")
r=kpi(ws,r,"Digital tax stamps",f"=SUM(OFFSET(MONTHLY!$C${M['2220']},0,0,1,TvA!$B$4))*-1",NUM,"15 UGX per unit, refills included")
r=kpi(ws,r,"Input VAT recoverable",f"=SUM(OFFSET(MONTHLY!$C${M['1300']},0,0,1,TvA!$B$4))",NUM,"Only as good as our EFRIS discipline")
r+=1
r=sect(ws,r,"PAYROLL STATUTORY",4)
r=kpi(ws,r,"PAYE withheld",f"=SUM(OFFSET(MONTHLY!$C${M['2300']},0,0,1,TvA!$B$4))*-1")
r=kpi(ws,r,"NSSF — employee 5%",None,NUM)
r=kpi(ws,r,"NSSF — employer",None,NUM,"GAP-04: recorded 5%, statutory 10%. CONFIRM before payroll runs.")
r=kpi(ws,r,"Local Service Tax",None,NUM,"GAP-05: NOT IN THE MODEL AT ALL")
r+=1
r=sect(ws,r,"CORPORATE TAX",4)
r=kpi(ws,r,"Accrued year to date",f"=SUM(OFFSET('P&L'!$C${P_tax},0,0,1,TvA!$B$4))")
r=kpi(ws,r,"Paid year to date",None,NUM)
r=kpi(ws,r,"Payable",f"=-{BSCUR.format(L_ctax,L_ctax)}*-1",NUM,"Accrues monthly, PAID QUARTERLY")
r+=1
r=sect(ws,r,"FILING CALENDAR — fix a date each month and never move it",4)
for a,b in [("VAT return","15th of the following month"),("PAYE and NSSF","15th of the following month"),
            ("Corporate tax (provisional)","Quarterly"),("Trading licence (KCCA)","Annual — 600,000"),
            ("Local Service Tax","GAP-05 — confirm the cycle"),("Annual return","Annual")]:
    ws.cell(r,1,a); ws.cell(r,2,b).font=B; r+=1
r+=1
ws.cell(r,1,"29.1% of gross billings is VAT and excise. None of it is ours. Do not spend it.").font=B

# ---- VIEW: LENDERS ----
ws,r=viewsheet("VIEW · LENDERS","LENDERS AND PARTNERS","Banks, DFIs, catalytic funders, trade partners",
  '"Can this business pay what it owes." — Renew CFO100 Session 4',
  "Capacity to service, not growth story. A lender is underwriting the downside, so show them you have one.")
r=sect(ws,r,"CAPACITY TO SERVICE",4)
r=kpi(ws,r,"EBITDA year to date",f"=SUM(OFFSET('P&L'!$C${P_ebit},0,0,1,TvA!$B$4))+SUM(OFFSET(MONTHLY!$C${M['7000']},0,0,1,TvA!$B$4))",NUM,"Profit before tax plus depreciation")
r=kpi(ws,r,"Total debt",f"=-{BSCUR.format(L_loan,L_loan)}*-1",NUM,"None today — self-funded")
r=kpi(ws,r,"Debt to EBITDA",None,'0.00"x"',"Target under 3.0x")
r=kpi(ws,r,"DSCR",None,'0.00"x"',"EBITDA / debt service")
r=kpi(ws,r,"Indicative debt capacity",400000,'#,##0',"USD, at 1.25x cover — from the model, Site 1 only")
r+=1
r=sect(ws,r,"LIQUIDITY AND THE DOWNSIDE",4)
r=kpi(ws,r,"Cash genuinely ours",f"={BSCUR.format(B_own,B_own)}",NUM,"Excludes refundable deposits")
r=kpi(ws,r,"Minimum cash floor (policy)",f"={S(r_floor)}",NUM)
r=kpi(ws,r,"Lowest projected cash point",17548449,NUM,"Month 1 of the plan. No facility behind it.")
r=kpi(ws,r,"Cash conversion cycle",None,'0.0"d"',"Plan: 3 days. Inventory only.")
r+=1
r=sect(ws,r,"WHAT WE WOULD PLEDGE, AND WHAT WE WOULD NOT",4)
ws.cell(r,1,"Plant and equipment at cost"); ws.cell(r,2,315000000).number_format=NUM; r+=1
ws.cell(r,1,"Customer deposits — NOT available as security").font=B
ws.cell(r,2,f"={BSCUR.format(L_dep,L_dep)}").number_format=NUM
ws.cell(r,4,"It is customers' money. Never offer it as headroom.").font=I; r+=2
ws.cell(r,1,"A lender will ask what happens at 60% of plan. The answer lives in the one-site model's scenario cell — bring it, do not wait to be asked.").font=I

# ---- VIEW: GROWTH ----
ws,r=viewsheet("VIEW · GROWTH","GROWTH","Sammy, co-founders, and anyone funding the next site",
  "Whether the next step is earned or merely wanted",
  "Renew's structural question: is the hiring step-up plus the expansion affordable given the ramp? The fix here is not a timing trick — it is a decision about pace.")
r=sect(ws,r,"IS SITE 1 EARNING THE RIGHT TO A SITE 2?",4)
r=kpi(ws,r,"Capacity utilisation",None,PCT,"Actual jars/day against 2,000/day capacity")
r=kpi(ws,r,"Months at or above full break-even",None,'#,##0',"Renew would want several consecutive")
r=kpi(ws,r,"Cash genuinely ours",f"={BSCUR.format(B_own,B_own)}",NUM,"The only cash that can fund anything")
r=kpi(ws,r,"Gross margin trend",None,PCT,"Plan: rising every month as mix shifts to refill")
r+=1
r=sect(ws,r,"THE CUSTOMER ENGINE — mostly unmeasured, and that is the problem",4)
r=kpi(ws,r,"New jar customers this month",None,'#,##0',"Plan assumes 750 every month, flat, forever")
r=kpi(ws,r,"Jar customers lost (churn)",None,'#,##0',"GAP-20 — NOT MODELLED")
r=kpi(ws,r,"Cost to acquire one jar customer",None,NUM,"GAP-18 — NOT MODELLED. No marketing line exists.")
r=kpi(ws,r,"Revenue per jar customer per month",None,NUM,"")
r=kpi(ws,r,"Lifetime value per jar customer",None,NUM,"Needs churn first")
r+=1
r=sect(ws,r,"THE DECISION GATES",4)
for a,b in [("AP/AR clerk","650 jars/day — pays for itself on input VAT recovery alone"),
            ("Accounting / Finance Manager","950 jars/day"),
            ("GL Accountant","1,400 jars/day"),
            ("Financial Controller","Site 2 committed"),
            ("CFO as a real seat","Site 3, or a raise closed — when there is a board and a cap table to serve")]:
    ws.cell(r,1,a); ws.cell(r,2,b).font=B; r+=1
r+=1
ws.cell(r,1,"The hiring step at month 5 costs 72,600,000 UGX of cash over thirteen months. Toggle it in the one-site model and read the difference before committing.").font=I

# ============ ACCESS ============
ws=wb.create_sheet("ACCESS")
for col,w in zip("ABCD",[34,22,26,62]): ws.column_dimensions[col].width=w
ws.cell(1,1,"ACCESS — who runs it, who sees what").font=H1
ws.cell(2,1,"Renew best practice #2: group users of financial reports by role. It protects data privacy and keeps one version of the truth.").font=I
r=4
for i,h in enumerate(["Who","Access level","Sees","Notes"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
for row in [("Sammy (founder / acting CFO)","OWNER — edit all","Everything","Runs it. Owns the close, the Monday forecast and every view."),
  ("Co-founder(s)","Edit","Everything","Same visibility as the CFO. No filtered version between founders."),
  ("AP/AR clerk (from 650 jars/day)","Edit JOURNAL only","JOURNAL, COST BOOK","Daily entry. Cannot change SETUP, BUDGET or any view."),
  ("Accountant / bookkeeper","Edit JOURNAL + COA","Input layer, P&L, BS","Second pair of eyes. Our only real compensating control."),
  ("Auditor (once appointed)","Comment","Everything","GAP-17 — not appointed yet"),
  ("Investors","VIEW ONLY link","VIEW · INVESTORS","Never share the whole file. Share the view."),
  ("Lenders / partners","VIEW ONLY link","VIEW · LENDERS","Same rule."),
  ("Tax advisor / URA","VIEW ONLY link","VIEW · TAX (URA)","Plus source documents on request."),
  ("Plant and route staff","VIEW ONLY link","VIEW · INTERNAL","The break-even number should be on the wall.")]:
    for i,v in enumerate(row): ws.cell(r,1+i,v)
    r+=1
r+=1
for tx in ["THE RULE: outsiders get a link to ONE TAB, never to the file.",
           "In Google Sheets: File > Share > publish or share a single sheet, or copy the view into a separate shared file that pulls from here with IMPORTRANGE.",
           "Nobody edits a view. If a view is wrong, the JOURNAL is wrong — fix it there.",
           "One person owns the close. Today that is Sammy. When the AP/AR clerk arrives, entry moves; ownership does not."]:
    ws.cell(r,1,tx).font=I; r+=1


# ============ CASH 13-WEEK ============
ws=wb.create_sheet("CASH 13-WEEK")
ws.column_dimensions['A'].width=46; ws.column_dimensions['B'].width=14
for i in range(13): ws.column_dimensions[gcl(3+i)].width=14
ws.column_dimensions['P'].width=16; ws.freeze_panes="C1"
ws.cell(1,1,"13-WEEK ROLLING CASH FORECAST").font=H1
ws.cell(2,1,"THE STANDING RULE: every Monday morning once we are selling, roll this forward one week and type what you actually expect. Then read the ALARM row.").font=I
r=4
ws.cell(r,1,"Week commencing").font=B
for i in range(13):
    c=ws.cell(r,3+i,f"=SETUP!$B${r_fy}+{i*7}"); c.number_format='dd-mmm'; c.font=B; c.alignment=Alignment(horizontal="center"); c.border=BOX
ws.cell(r,16,"13-WK TOTAL").font=B; r+=1
def wrow(label,fmt=NUM,inp=False,formula=None,bold=False,fill=None,tot=True):
    global r
    ws.cell(r,1,label)
    if bold: ws.cell(r,1).font=B
    for i in range(13):
        c=ws.cell(r,3+i, formula(i) if formula else None); c.number_format=fmt
        if bold: c.font=B
        if inp: c.fill=PatternFill("solid",fgColor=BLUE)
        if fill: c.fill=PatternFill("solid",fgColor=fill)
    if tot:
        c=ws.cell(r,16,f"=SUM(C{r}:O{r})"); c.number_format=fmt; c.font=B
    rr=r; r+=1; return rr
W_op=wrow("OPENING CASH",bold=True,tot=False)
r=sect(ws,r,"RECEIPTS",16)
w1=wrow("Cash sales — refill and single-use",inp=True)
w2=wrow("Jar deposits received",inp=True)
w3=wrow("Input VAT refunds from URA",inp=True)
w4=wrow("Other receipts / financing",inp=True)
wrt=wrow("TOTAL RECEIPTS",bold=True,formula=lambda i:f"=SUM({gcl(3+i)}{w1}:{gcl(3+i)}{w4})")
r=sect(ws,r,"PAYMENTS",16)
p1=wrow("Raw materials and packaging",inp=True)
p2=wrow("Jar purchases",inp=True)
p3=wrow("Salaries, PAYE and NSSF",inp=True)
p4=wrow("Rent, power, security, other overheads",inp=True)
p5=wrow("Delivery and fuel",inp=True)
p6=wrow("URA — VAT and excise",inp=True)
p7=wrow("URA — corporate tax",inp=True)
p8=wrow("Jar deposit REFUNDS",inp=True)
p9=wrow("Capex and other",inp=True)
wpt=wrow("TOTAL PAYMENTS",bold=True,formula=lambda i:f"=SUM({gcl(3+i)}{p1}:{gcl(3+i)}{p9})")
r+=1
wnm=wrow("NET MOVEMENT",bold=True,formula=lambda i:f"={gcl(3+i)}{wrt}-{gcl(3+i)}{wpt}")
wcl=wrow("CLOSING CASH",bold=True,fill=GREY,tot=False,formula=lambda i:f"={gcl(3+i)}{W_op}+{gcl(3+i)}{wnm}")
for i in range(13):
    ws.cell(W_op,3+i, f"=SETUP!$B${r_ocash}" if i==0 else f"={gcl(2+i)}{wcl}")
wfl=wrow("Minimum cash floor",tot=False,formula=lambda i:f"=SETUP!$B${r_floor}")
whd=wrow("HEADROOM",bold=True,tot=False,formula=lambda i:f"={gcl(3+i)}{wcl}-{gcl(3+i)}{wfl}")
wal=wrow("ALARM",fmt='General',bold=True,fill=WARN,tot=False,formula=lambda i:f'=IF({gcl(3+i)}{wcl}<{gcl(3+i)}{wfl},"BREACH","ok")')
r+=1
for tx in ["Renew, Session 4, on the weekly cash meeting: 'Review the end cash position with the forecast. Any difference? Any payments we need to slow or receipts we need to accelerate?'",
           "Their Accounting and Finance Team Checklist puts this on the Finance Manager as a WEEKLY duty.",
           "Jar deposits received are NOT revenue. They are here because they are cash, and this tab is about cash.",
           "Jar deposit REFUNDS is a row on purpose. It is zero today and it will not stay zero."]:
    ws.cell(r,1,tx).font=I; r+=1

# ============ GAPS ============
ws=wb.create_sheet("GAPS")
for col,w in zip("ABCDEF",[10,50,20,18,20,62]): ws.column_dimensions[col].width=w
ws.cell(1,1,"GAPS — what we do not know, who answers it, and by when").font=H1
ws.cell(2,1,"Nothing in this workbook is guessed silently. Every unknown is here with a name against it. Blockers must clear BEFORE 1 October.").font=I
r=4
for i,h in enumerate(["ID","What we need","Blocks","Owner","Due","Why it matters"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
GAPS=[
("GAP-01","URA TIN","Every filing","Sammy","Before 1 Oct","Cannot file anything without it"),
("GAP-02","VAT registered? From what date?","Pricing and every invoice","Sammy","BEFORE 1 OCT","If not registered, we charge no output VAT and recover no input VAT. Changes price, margin and cash from day one."),
("GAP-03","EFRIS enrolled?","Input VAT recovery","Sammy","BEFORE 1 OCT","The 75% recovery assumption is worth ~39.5m/yr and is EARNED by EFRIS invoices. No EFRIS, no recovery."),
("GAP-04","NSSF EMPLOYER rate — 5% or 10%?","Payroll, P&L, cash","Sammy","BEFORE first payroll","Model says 5%, statutory is 10%. On 118.9m of wages this is material and it understates cost."),
("GAP-05","Local Service Tax — rate and cycle","Payroll","Sammy","BEFORE first payroll","Absent from the model entirely"),
("GAP-06","UNBS certification — status and date","Whether we can sell at all","Sammy","BEFORE 1 OCT","A delay pushes the whole ramp right and turns a one-month loss into a one-quarter loss"),
("GAP-07","Opening cash at 1 Oct — bank, mobile, petty","Everything","Sammy","30 Sep","The model assumes 4,000,000. Count it, do not assume it."),
("GAP-08","Opening inventory at 1 Oct — physical count","Balance sheet, COGS","Sammy","30 Sep","Model assumes 5,112,500"),
("GAP-09","Jars already in the field, deposits already held","Deposit liability","Sammy","30 Sep","If any jars are out there, we already owe that money back"),
("GAP-10","Opening receivables, payables, loans","Balance sheet","Sammy","30 Sep","Model assumes all three are zero"),
("GAP-11","Plant life and membrane replacement schedule","Depreciation, capex","Sammy","Oct","Zero maintenance capex in a full year of 2,000 jars/day cannot be right"),
("GAP-12","Real cap table — share capital, investor terms","Investor view, equity","Sammy","Oct","The model's equity is DERIVED, not the real cap table"),
("GAP-13","Bill of materials per SKU","Cost of sales","Sammy","Oct","We know the COGS total, not the cost lines. You cannot find a reason inside a blended number."),
("GAP-14","Delivery and logistics — own or hired, what cost?","Cost of sales","Sammy","Oct","Not visible anywhere in the model"),
("GAP-15","Headcount register — roles at each payroll step","Payroll","Sammy","BEFORE first payroll","2,575,000 then 13,575,000 at month 5. Which roles, how many heads?"),
("GAP-16","Breakdown of the 8,163,542 monthly overhead","Operating costs","Sammy","Oct","One blended number covering rent, power, security, internet, insurance, repairs, cleaning"),
("GAP-17","Appoint an auditor","Credibility, raise readiness","Sammy","Q1","Cheaper now than under a raise deadline"),
("GAP-18","Marketing budget and cost per acquired customer","Growth view","Sammy","Oct","The plan wins 750 new jar customers a month at zero cost. Investors will ask."),
("GAP-19","Approve or replace the two middle B2B ladder bands","Revenue mix","Sammy","BEFORE 1 OCT","Half the ladder is unapproved, so part of the revenue plan is assumption"),
("GAP-20","Jar return / churn rate, and a refund policy","Deposits, cash","Sammy + tax advisor","BEFORE 1 OCT","Zero returns is modelled. Also open: does VAT crystallise on a forfeited deposit?"),
("GAP-21","Bank accounts and mobile money merchant accounts","Cash, reconciliation","Sammy","BEFORE 1 OCT","Daily bank reconciliation needs daily balance access"),
("GAP-22","Who else gets edit access, and when","Controls","Sammy","Oct","Today it is one person, which means no segregation of duties"),
]
for g in GAPS:
    for i,v in enumerate(g): ws.cell(r,1+i,v)
    if "BEFORE" in g[4] or g[4]=="30 Sep":
        for cc in range(1,7): ws.cell(r,cc).fill=PatternFill("solid",fgColor=WARN)
    r+=1
r+=1
ws.cell(r,2,"Highlighted rows block the 1 October start. Everything else can follow in October.").font=B; r+=2
ws.cell(r,2,"Renew, Session 2: \"I don't know yet. I will have that by Thursday at noon.\" Admit, commit to a time, deliver. Bluffing is fatal.").font=I

# ============ CHECKS ============
ws=wb.create_sheet("CHECKS")
for col,w in zip("ABCD",[54,22,22,56]): ws.column_dimensions[col].width=w
ws.cell(1,1,"CHECKS — run these before anything leaves this file").font=H1
r=3
for i,h in enumerate(["Check","Value","Should be","Verdict"]):
    c=ws.cell(r,1+i,h); c.font=WHITEB; c.fill=PatternFill("solid",fgColor=NAVY)
r+=1
CHK=[("Journal balances (debits = credits)",f"=MONTHLY!C{MCHK}","0"),
     ("Balance sheet balances (month 1)",f"='BALANCE SHEET'!C{BCHK}","0"),
     ("Balance sheet balances (month 12)",f"='BALANCE SHEET'!N{BCHK}","0"),
     ("Journal rows with no account code",f"=COUNTIFS(JOURNAL!$A${JFIRST}:$A${JLAST},\"<>\",JOURNAL!$C${JFIRST}:$C${JLAST},\"\")","0"),
     ("Journal rows with neither debit nor credit",f"=COUNTIFS(JOURNAL!$A${JFIRST}:$A${JLAST},\"<>\",JOURNAL!$I${JFIRST}:$I${JLAST},0,JOURNAL!$J${JFIRST}:$J${JLAST},0)","0"),
     ("Gaps still blocking the 1 Oct start","=COUNTIF(GAPS!E:E,\"BEFORE 1 OCT\")+COUNTIF(GAPS!E:E,\"30 Sep\")+COUNTIF(GAPS!E:E,\"BEFORE first payroll\")","0 by 1 Oct")]
for lab,f,tgt in CHK:
    ws.cell(r,1,lab); c=ws.cell(r,2,f); c.number_format=NUM; c.font=B
    ws.cell(r,3,tgt)
    v=ws.cell(r,4,f'=IF(B{r}=0,"OK","FIX THIS FIRST")'); v.font=B; v.fill=PatternFill("solid",fgColor=WARN)
    r+=1
r+=1
for tx in ["Renew's pre-send checklist, Session 4:",
           "  Can I trust this data?  Does it cover what actually matters?  Is it still timely?",
           "  Is it clear enough to digest in under a minute?",
           "  If the answer to any of those is no, it isn't ready.",
           "",
           "Renew's pre-send integrity checklist, Session 2 — BEFORE SENDING THE FS TO THE CEO:",
           "  cash check, net income check, receivables, payables, inventory, non-cash expense, interest, unusual variance."]:
    ws.cell(r,1,tx).font=I if not tx.startswith("Renew") else B; r+=1

out="/home/user/CFO-system/models/MajiSafi_FINANCIAL_SOURCE_OF_TRUTH.xlsx"
wb.save(out)
print("SAVED",out)
print(len(wb.sheetnames),"tabs:",wb.sheetnames)
