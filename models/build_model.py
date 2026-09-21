import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as gcl

# ---------- published Year-1 source figures (majisafiyearone.xlsx) ----------
NET  = [71515659,88697546,104744328,119797947,133993782,147461023,160323021,172697614,184697433,196430183,207998913,219502263]
COGS = [50496944,61962807,72074723,80890265,88464342,94849354,100095332,104250071,107359255,109466568,110613809,110840984]
VATX = [26140341,32950103,39609883,46142454,52569535,58911850,65189190,71420459,77623726,83816270,90014624,96234612]
INV  = [5874694,7021281,8032472,8914027,9671434,10309935,10834533,11250007,11560925,11771657,11886381,11909098]
DEPR = [12768750,12826534,12884318,12942102,12999886,13057670,13115455,13173239,13231023,13288807,13346591,13404375]
SAL  = [2575000]*4 + [13575000]*8
DAYS, JAR_N, JAR_C = 26, 750, 11000
FIXED, PLANT, LIFE, TAXR = 8163542, 315000000, 60, 0.30
OPEN_CASH, OPEN_INV, TXN_PCT = 4000000, 5112500, 0.005

# volume ramp: M1=500/day and M12=2000/day are published; M2-M11 linear (DERIVED)
JPD   = [500 + i*(1500/11) for i in range(12)]
UNITS = [j*DAYS for j in JPD]
RPU   = [NET[i]/UNITS[i] for i in range(12)]          # net revenue per unit
CPU   = [COGS[i]/UNITS[i] for i in range(12)]         # cogs per unit
UPL   = [VATX[i]/NET[i] for i in range(12)]           # URA uplift on net revenue
DIO   = [INV[i]/COGS[i]*30 for i in range(12)]        # inventory days
DPJ   = [DEPR[i]/JAR_N for i in range(12)]            # avg deposit per jar

# ---------- styling ----------
NAVY="FF1F3864"; IN="FFFFF2CC"; CALC="FFF2F2F2"; HDR="FF1F3864"; WARN="FFFDE9D9"
BLUE="FFDDEBF7"  # Renew convention: blue = input, black = formula, yellow = live-edit
H1=Font(bold=True,size=14,color="FF1F3864"); H2=Font(bold=True,size=11,color="FFFFFFFF")
BOLD=Font(bold=True); ITAL=Font(italic=True,size=9,color="FF808080")
NUM='#,##0;[Red]-#,##0'; PCT='0.0%'; DEC='#,##0.00'
thin=Side(style='thin',color="FFD0D0D0"); BOX=Border(bottom=thin)

def sect(ws,r,title):
    ws.cell(r,1,title).font=H2
    for c in range(1,16): ws.cell(r,c).fill=PatternFill("solid",fgColor=HDR)
    return r+1

def note(ws,r,txt):
    ws.cell(r,1,txt).font=ITAL; return r+1

def row(ws,r,label,unit,vals,fmt=NUM,inp=False,bold=False,total=None,live=False):
    ws.cell(r,1,label); ws.cell(r,2,unit).font=ITAL
    if bold: ws.cell(r,1).font=BOLD
    for i in range(12):
        c=ws.cell(r,3+i,vals[i] if vals else None); c.number_format=fmt
        if inp: c.fill=PatternFill("solid",fgColor=IN if live else BLUE)
        if bold: c.font=BOLD
    if total:
        c=ws.cell(r,15,total.format(r=r)); c.number_format=fmt; c.font=BOLD
    return r+1

def months(ws,r):
    ws.cell(r,1,"").font=BOLD
    for i in range(12):
        c=ws.cell(r,3+i,f"M{i+1}"); c.font=BOLD; c.alignment=Alignment(horizontal="center"); c.border=BOX
    c=ws.cell(r,15,"YEAR 1"); c.font=BOLD; c.alignment=Alignment(horizontal="center"); c.border=BOX
    return r+1

def widths(ws):
    ws.column_dimensions['A'].width=46; ws.column_dimensions['B'].width=22
    for i in range(12): ws.column_dimensions[gcl(3+i)].width=15
    ws.column_dimensions['O'].width=17
    ws.freeze_panes="C1"

SUM12="=SUM(C{r}:N{r})"

def build(blank:bool):
    wb=openpyxl.Workbook(); A="ASSUMPTIONS"
    def v(x): return None if blank else x
    def vl(x): return None if blank else x

    # ================= README =================
    ws=wb.active; ws.title="README"
    ws.column_dimensions['A'].width=110
    kind = "BLANK TEMPLATE — fill it in" if blank else "PREDICTION — Year 1 plan"
    lines=[
    ("Maji Safi — One Site Financial Model",H1),
    (f"Safiflow Ventures Group Limited, t/a Maji Safi · Lukuli Road, Buziga, Kampala",None),
    (f"{kind}",BOLD),("",None),
    ("HOW THIS WORKBOOK WORKS",BOLD),
    ("You type in ONE tab only: ASSUMPTIONS. Yellow cells are inputs. Everything else is a formula.",None),
    ("Change a yellow cell and the P&L, balance sheet, cash flow, break-even and ratios all move.",None),
    ("This is the fix for the old workbook, which was a snapshot that did not recompute.",None),("",None),
    ("THE SCENARIO SWITCH",BOLD),
    ("ASSUMPTIONS cell C5 is a single volume multiplier. Set it to 60% and read the cash line.",None),
    ("That is the answer to 'what happens if we miss plan' — live, in the meeting, not after a rebuild.",None),("",None),
    ("TABS",BOLD),
    ("  ASSUMPTIONS   every input. The only place you type.",None),
    ("  P&L           twelve-month statement of profit or loss",None),
    ("  BALANCE SHEET twelve-month position. The CHECK row must read zero.",None),
    ("  CASH FLOW     twelve-month statement of cash flows",None),
    ("  13-WEEK CASH  the rolling weekly forecast. Revise it every Friday.",None),
    ("  BREAK-EVEN    jars/day needed, with and without the jar programme",None),
    ("  RATIOS        the four families from CFO100 Session 3",None),
    ("  CHECKS        integrity checks and what is input vs derived",None),("",None),
    ("RULES THAT GOVERN THE NUMBERS",BOLD),
    ("1. Revenue is NET of VAT and excise. Those are collected for URA and are never our revenue.",None),
    ("2. The 20L jar is a DEPOSIT, never revenue. It is a liability, repayable when the jar returns.",None),
    ("3. The jar cost is expensed in full on issue, not capitalised.",None),
    ("4. Water in a reusable jar is always a refill, including the first fill.",None),
    ("5. B2B has a list price and a floor earned on LAST month's volume. B2C has one price, no discount.",None),
    ("6. A deposit is never discounted.",None),("",None),
    ("WHAT IS NOT IN HERE YET — add these, do not pretend they are zero",BOLD),
    ("  Jar return / attrition rate and deposit refunds (currently modelled as zero refunds)",None),
    ("  Trade receivables and a bad-debt provision (currently zero — every sale is cash)",None),
    ("  Trade payables (currently zero — we pay everyone immediately)",None),
    ("  Maintenance capex and membrane/filter replacement (currently zero in Year 1)",None),
    ("  NSSF employer contribution at the statutory 10%, and Local Service Tax",None),
    ("  Rows exist for the first three. They are set to zero so the gap is visible, not hidden.",ITAL),
    ]
    r=1
    for t,f in lines:
        c=ws.cell(r,1,t)
        if f: c.font=f
        r+=1

    # ================= ASSUMPTIONS =================
    ws=wb.create_sheet(A); widths(ws)
    def single(rr,label,val,fmt,unit="",live=False):
        ws.cell(rr,1,label); ws.cell(rr,2,unit).font=ITAL
        c=ws.cell(rr,3,v(val)); c.number_format=fmt
        c.fill=PatternFill("solid",fgColor=IN if live else BLUE)
        if live: c.font=BOLD
        return rr+1
    ws.cell(1,1,"ASSUMPTIONS — the only tab you type in").font=H1
    ws.cell(2,1,"Renew convention: BLUE = input · black = formula · YELLOW = live-edit decision cell.").font=ITAL
    AC0=lambda rr: f"$C${rr}"
    r=4
    r=sect(ws,r,"SCENARIO")
    ws.cell(r,1,"Volume scenario multiplier"); ws.cell(r,2,"100% = plan").font=ITAL
    c=ws.cell(r,3, 1.0 if not blank else None); c.number_format=PCT; c.fill=PatternFill("solid",fgColor=IN); c.font=BOLD
    SCEN=f"${A}.$C${r}" ; SCEN_LOCAL=f"$C${r}"
    r+=1
    r=note(ws,r,"Set to 0.6 to see the downside. Every tab reacts. Set back to 1.0 for the plan.")
    r+=1

    r=sect(ws,r,"VOLUME")
    r_days=r; r=row(ws,r,"Operating days per month","days",[v(DAYS)]*12,'#,##0',inp=True)
    r_jpd=r;  r=row(ws,r,"Jars per day — plan","jars/day",[v(round(x,1)) for x in JPD],DEC,inp=True)
    r_un=r;   r=row(ws,r,"UNITS PER MONTH","units",[f"=C{r_days}*C{r_jpd}*{SCEN_LOCAL}".replace("C",gcl(3+i),1) for i in range(12)],'#,##0',bold=True,total=SUM12)
    for i in range(12):
        ws.cell(r_un,3+i, f"={gcl(3+i)}{r_days}*{gcl(3+i)}{r_jpd}*{SCEN_LOCAL}")
    r=note(ws,r,"M1 = 500/day and M12 = 2,000/day are from the source model. M2-M11 are a straight-line ramp, DERIVED here — replace them with what sales can actually commit to.")
    r+=1

    r=sect(ws,r,"PRICE AND COST PER UNIT")
    r_rpu=r; r=row(ws,r,"Net revenue per unit","UGX/unit",[v(round(x,2)) for x in RPU],DEC,inp=True)
    r_cpu=r; r=row(ws,r,"Cost of sales per unit, net of input VAT","UGX/unit",[v(round(x,2)) for x in CPU],DEC,inp=True)
    r_upl=r; r=row(ws,r,"URA uplift — VAT + excise on net revenue","% of net rev",[v(round(x,4)) for x in UPL],PCT,inp=True)
    r=note(ws,r,"Revenue per unit FALLS across the year as the mix shifts to refill and B2C. That is intended, not an error.")
    r+=1

    r=sect(ws,r,"JAR DEPOSIT PROGRAMME")
    r_jn=r;  r=row(ws,r,"LIVE EDIT — new jars issued per month","jars",[v(JAR_N)]*12,'#,##0',inp=True,live=True)
    r_jc=r;  r=row(ws,r,"Jar cost — expensed on issue","UGX/jar",[v(JAR_C)]*12,'#,##0',inp=True)
    r_dpj=r; r=row(ws,r,"Average deposit taken per jar","UGX/jar",[v(round(x,2)) for x in DPJ],DEC,inp=True)
    r_ret=r; r=row(ws,r,"Jars RETURNED and refunded per month","jars",[v(0)]*12,'#,##0',inp=True)
    r=note(ws,r,"Returns are set to ZERO. That is a known gap, not a fact. Put a real number here the moment you have one — every returned jar is cash out with no revenue against it.")
    r+=1

    r=sect(ws,r,"OVERHEADS")
    r_fix=r; r=row(ws,r,"Fixed operating costs","UGX/month",[v(FIXED)]*12,NUM,inp=True)
    r_sbase=r; r=single(r,"Base payroll, before the hiring step",2575000,NUM,"UGX/month")
    r_sstep=r; r=single(r,"LIVE EDIT — additional payroll from hiring",11000000,NUM,"UGX/month; set 0 for no-hire",live=True)
    r_smon=r;  r=single(r,"Hiring takes effect starting month #",5,'#,##0',"month",live=True)
    r_sal=r;   r=row(ws,r,"Salaries and wages (computed)","UGX/month",None,NUM)
    for i in range(12):
        ws.cell(r_sal,3+i, f"={AC0(r_sbase)}+IF({i+1}>={AC0(r_smon)},{AC0(r_sstep)},0)")
    r_txn=r; r=row(ws,r,"Transaction fees","% of gross billings",[v(TXN_PCT)]*12,PCT,inp=True)
    r=note(ws,r,"Salaries step 5.3x at M5. NSSF employer is recorded at 5%; the statutory rate is 10% — CONFIRM and correct here.")
    r+=1

    r=sect(ws,r,"WORKING CAPITAL")
    r_dio=r; r=row(ws,r,"Inventory days on hand (DIO)","days",[v(round(x,2)) for x in DIO],DEC,inp=True)
    r_dso=r; r=row(ws,r,"Debtor days (DSO)","days",[v(0)]*12,DEC,inp=True)
    r_dpo=r; r=row(ws,r,"Creditor days (DPO)","days",[v(0)]*12,DEC,inp=True)
    r=note(ws,r,"DSO and DPO are ZERO — we pay instantly and are paid instantly. The most fragile shape possible. One institution on 30 days and this stops being true.")
    r+=1

    r=sect(ws,r,"CAPITAL, TAX AND POLICY")
    r_plant=r; r=single(r,"Plant and equipment at cost",PLANT,NUM,"UGX")
    r_life=r;  r=single(r,"Depreciation life",LIFE,'#,##0',"months")
    r_tax=r;   r=single(r,"Corporate income tax rate",TAXR,PCT,"of taxable profit")
    r_ocash=r; r=single(r,"Opening cash",OPEN_CASH,NUM,"UGX")
    r_oinv=r;  r=single(r,"Opening inventory",OPEN_INV,NUM,"UGX")
    r_floor=r; r=single(r,"MINIMUM CASH FLOOR — policy",20000000,NUM,"UGX")
    r_cxamt=r; r=single(r,"LIVE EDIT — Site 2 / expansion capex",0,NUM,"UGX",live=True)
    r_cxmon=r; r=single(r,"Capex month #",9,'#,##0',"month",live=True)
    r_capex=r; r=row(ws,r,"Capital expenditure (computed)","UGX/month",None,NUM)
    for i in range(12):
        ws.cell(r_capex,3+i, f"=IF({i+1}={AC0(r_cxmon)},{AC0(r_cxamt)},0)")
    r=note(ws,r,"Capex is ZERO for Year 1. A UF plant running 2,000 jars/day consumes membranes and filters. Put the replacement schedule in here.")
    r=note(ws,r,"THE STRUCTURAL QUESTION this model exists to surface (Renew's phrasing, applied to us): is the hiring step-up at month 5 PLUS the jar programme affordable given the volume ramp? Unlike the 13-week model, the fix here is not a timing trick — it is a decision about the pace of expansion.")
    r=note(ws,r,"Tax accrues monthly on cumulative profit (losses carried forward) and is PAID QUARTERLY in M3, M6, M9, M12.")

    AS=lambda rr,i: f"{A}!{gcl(3+i)}{rr}"
    AC=lambda rr: f"{A}!$C${rr}"

    # ================= P&L =================
    ws=wb.create_sheet("P&L"); widths(ws)
    ws.cell(1,1,"STATEMENT OF PROFIT OR LOSS").font=H1
    ws.cell(2,1,"UGX · net of VAT and excise · every cell is a formula").font=ITAL
    r=4; r=months(ws,r)
    def frow(label,unit,f,fmt=NUM,bold=False,tot=True,fill=None):
        nonlocal r
        ws.cell(r,1,label); ws.cell(r,2,unit).font=ITAL
        if bold: ws.cell(r,1).font=BOLD
        for i in range(12):
            c=ws.cell(r,3+i,f(i)); c.number_format=fmt
            if bold: c.font=BOLD
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        if tot:
            c=ws.cell(r,15,SUM12.format(r=r)); c.number_format=fmt; c.font=BOLD
        rr=r; r+=1; return rr
    p_units=frow("Units sold","units",lambda i:f"={AS(r_un,i)}",'#,##0')
    p_net  =frow("NET REVENUE","UGX",lambda i:f"={AS(r_un,i)}*{AS(r_rpu,i)}",bold=True)
    p_gross=frow("  memo: gross billings (VAT-inclusive)","UGX",lambda i:f"=C{p_net}*(1+{AS(r_upl,i)})".replace("C",gcl(3+i),1))
    for i in range(12): ws.cell(p_gross,3+i,f"={gcl(3+i)}{p_net}*(1+{AS(r_upl,i)})")
    p_ura  =frow("  memo: VAT and excise collected for URA","UGX",lambda i:f"={gcl(3+i)}{p_net}*{AS(r_upl,i)}")
    p_cogs =frow("Cost of sales, net of input VAT","UGX",lambda i:f"=-{AS(r_un,i)}*{AS(r_cpu,i)}")
    p_jar  =frow("Jar cost expensed on issue","UGX",lambda i:f"=-{AS(r_jn,i)}*{AS(r_jc,i)}")
    p_gp   =frow("GROSS PROFIT","UGX",lambda i:f"={gcl(3+i)}{p_net}+{gcl(3+i)}{p_cogs}+{gcl(3+i)}{p_jar}",bold=True)
    p_fix  =frow("Fixed operating costs","UGX",lambda i:f"=-{AS(r_fix,i)}")
    p_sal  =frow("Salaries and wages","UGX",lambda i:f"=-{AS(r_sal,i)}")
    p_txn  =frow("Transaction fees","UGX",lambda i:f"=-{gcl(3+i)}{p_gross}*{AS(r_txn,i)}")
    p_ebd  =frow("EBITDA","UGX",lambda i:f"={gcl(3+i)}{p_gp}+{gcl(3+i)}{p_fix}+{gcl(3+i)}{p_sal}+{gcl(3+i)}{p_txn}",bold=True)
    p_dep  =frow("Depreciation","UGX",lambda i:f"=-{AC(r_plant)}/{AC(r_life)}")
    p_ebit =frow("EBIT / PROFIT BEFORE TAX","UGX",lambda i:f"={gcl(3+i)}{p_ebd}+{gcl(3+i)}{p_dep}",bold=True)
    p_tax  =frow("Corporate tax charge","UGX",lambda i:(f"=-MAX(0,{AC(r_tax)}*SUM($C${p_ebit}:{gcl(3+i)}{p_ebit})+SUM($C${r+0}:{gcl(2+i)}{r+0}))" if i>0 else f"=-MAX(0,{AC(r_tax)}*C{p_ebit})"))
    for i in range(12):
        ws.cell(p_tax,3+i, f"=-MAX(0,{AC(r_tax)}*SUM($C${p_ebit}:{gcl(3+i)}{p_ebit})" + (f"+SUM($C${p_tax}:{gcl(2+i)}{p_tax}))" if i>0 else ")"))
    p_np   =frow("NET PROFIT","UGX",lambda i:f"={gcl(3+i)}{p_ebit}+{gcl(3+i)}{p_tax}",bold=True,fill=CALC)
    r+=1; r=months(ws,r)
    m_gp=frow("Gross profit margin","% net rev",lambda i:f"={gcl(3+i)}{p_gp}/{gcl(3+i)}{p_net}",PCT,tot=False)
    m_eb=frow("EBITDA margin","% net rev",lambda i:f"={gcl(3+i)}{p_ebd}/{gcl(3+i)}{p_net}",PCT,tot=False)
    m_pt=frow("Pre-tax margin","% net rev",lambda i:f"={gcl(3+i)}{p_ebit}/{gcl(3+i)}{p_net}",PCT,tot=False)
    m_np=frow("Net profit margin","% net rev",lambda i:f"={gcl(3+i)}{p_np}/{gcl(3+i)}{p_net}",PCT,tot=False)
    for rr in (m_gp,m_eb,m_pt,m_np):
        ws.cell(rr,15,f"=O{rr-  (rr-m_gp)  }") # placeholder replaced below
    ws.cell(m_gp,15,f"=O{p_gp}/O{p_net}"); ws.cell(m_eb,15,f"=O{p_ebd}/O{p_net}")
    ws.cell(m_pt,15,f"=O{p_ebit}/O{p_net}"); ws.cell(m_np,15,f"=O{p_np}/O{p_net}")
    for rr in (m_gp,m_eb,m_pt,m_np): ws.cell(rr,15).number_format=PCT; ws.cell(rr,15).font=BOLD

    # ================= BALANCE SHEET =================
    ws2=wb.create_sheet("BALANCE SHEET"); widths(ws2)
    ws2.cell(1,1,"STATEMENT OF FINANCIAL POSITION").font=H1
    ws2.cell(2,1,"UGX · month-end · the CHECK row must read zero").font=ITAL
    r=4; r=months(ws2,r)
    def brow(label,f,fmt=NUM,bold=False,fill=None):
        nonlocal r
        ws2.cell(r,1,label)
        if bold: ws2.cell(r,1).font=BOLD
        for i in range(12):
            c=ws2.cell(r,3+i,f(i)); c.number_format=fmt
            if bold: c.font=BOLD
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        rr=r; r+=1; return rr
    ws2.cell(r,1,"ASSETS").font=BOLD; r+=1
    b_cash=brow("Cash and cash equivalents",lambda i:f"='CASH FLOW'!{gcl(3+i)}{{CLOSE}}")
    b_inv =brow("Inventories",lambda i:f"=-'P&L'!{gcl(3+i)}{p_cogs}*{AS(r_dio,i)}/30")
    b_rec =brow("Trade receivables",lambda i:f"='P&L'!{gcl(3+i)}{p_net}*{AS(r_dso,i)}/30")
    b_ppe =brow("Property, plant and equipment, at cost",lambda i:f"={AC(r_plant)}")
    b_acc =brow("  less accumulated depreciation",lambda i:f"=-{AC(r_plant)}/{AC(r_life)}*{i+1}")
    b_ta  =brow("TOTAL ASSETS",lambda i:f"=SUM({gcl(3+i)}{b_cash}:{gcl(3+i)}{b_acc})",bold=True)
    r+=1; ws2.cell(r,1,"LIABILITIES").font=BOLD; r+=1
    b_pay =brow("Trade and other payables",lambda i:f"=-'P&L'!{gcl(3+i)}{p_cogs}*{AS(r_dpo,i)}/30")
    b_tax =brow("Current tax payable",lambda i:f"=-SUM($C${p_tax}:{gcl(3+i)}'P&L'!{p_tax})")
    for i in range(12):
        ws2.cell(b_tax,3+i, f"=-SUM('P&L'!$C${p_tax}:'P&L'!{gcl(3+i)}{p_tax})-SUM('CASH FLOW'!$C${{TAXPAID}}:'CASH FLOW'!{gcl(3+i)}{{TAXPAID}})")
    b_dep2=brow("Customer deposits — refundable",lambda i:f"=SUM({A}!$C${r_jn}:{A}!{gcl(3+i)}{r_jn})")
    for i in range(12):
        ws2.cell(b_dep2,3+i, "="+"+".join(f"({A}!{gcl(3+k)}{r_jn}-{A}!{gcl(3+k)}{r_ret})*{A}!{gcl(3+k)}{r_dpj}" for k in range(i+1)))
    b_tl  =brow("TOTAL LIABILITIES",lambda i:f"=SUM({gcl(3+i)}{b_pay}:{gcl(3+i)}{b_dep2})",bold=True)
    r+=1; ws2.cell(r,1,"EQUITY").font=BOLD; r+=1
    b_sc  =brow("Share capital and opening equity (derived)",lambda i:f"={AC(r_ocash)}+{AC(r_oinv)}+{AC(r_plant)}")
    b_re  =brow("Retained earnings",lambda i:f"=SUM('P&L'!$C${p_np}:'P&L'!{gcl(3+i)}{p_np})")
    b_te  =brow("TOTAL EQUITY",lambda i:f"={gcl(3+i)}{b_sc}+{gcl(3+i)}{b_re}",bold=True)
    b_tle =brow("TOTAL LIABILITIES AND EQUITY",lambda i:f"={gcl(3+i)}{b_tl}+{gcl(3+i)}{b_te}",bold=True)
    b_chk =brow("CHECK — must be zero",lambda i:f"=ROUND({gcl(3+i)}{b_tle}-{gcl(3+i)}{b_ta},0)",bold=True,fill=WARN)
    r+=1
    ws2.cell(r,1,"Customer deposits are the largest liability here. It is customers' money, repayable when a jar comes back. Never present it as equity, headroom, or distributable profit.").font=ITAL

    # ================= CASH FLOW =================
    ws3=wb.create_sheet("CASH FLOW"); widths(ws3)
    ws3.cell(1,1,"STATEMENT OF CASH FLOWS").font=H1
    ws3.cell(2,1,"UGX · indirect method").font=ITAL
    r=4; r=months(ws3,r)
    def crow(label,f,fmt=NUM,bold=False,fill=None,tot=True):
        nonlocal r
        ws3.cell(r,1,label)
        if bold: ws3.cell(r,1).font=BOLD
        for i in range(12):
            c=ws3.cell(r,3+i,f(i)); c.number_format=fmt
            if bold: c.font=BOLD
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        if tot:
            c=ws3.cell(r,15,SUM12.format(r=r)); c.number_format=fmt; c.font=BOLD
        rr=r; r+=1; return rr
    f_np =crow("Net profit",lambda i:f"='P&L'!{gcl(3+i)}{p_np}")
    f_dep=crow("add back depreciation",lambda i:f"=-'P&L'!{gcl(3+i)}{p_dep}")
    f_tax=crow("add back tax accrued",lambda i:f"=-'P&L'!{gcl(3+i)}{p_tax}")
    f_inv=crow("movement in inventories",lambda i:(f"=-('BALANCE SHEET'!C{b_inv}-{AC(r_oinv)})" if i==0 else f"=-('BALANCE SHEET'!{gcl(3+i)}{b_inv}-'BALANCE SHEET'!{gcl(2+i)}{b_inv})"))
    f_rec=crow("movement in trade receivables",lambda i:(f"=-'BALANCE SHEET'!C{b_rec}" if i==0 else f"=-('BALANCE SHEET'!{gcl(3+i)}{b_rec}-'BALANCE SHEET'!{gcl(2+i)}{b_rec})"))
    f_pay=crow("movement in trade payables",lambda i:(f"='BALANCE SHEET'!C{b_pay}" if i==0 else f"=('BALANCE SHEET'!{gcl(3+i)}{b_pay}-'BALANCE SHEET'!{gcl(2+i)}{b_pay})"))
    f_cfo=crow("CASH FROM OPERATIONS",lambda i:f"=SUM({gcl(3+i)}{f_np}:{gcl(3+i)}{f_pay})",bold=True)
    f_din=crow("customer deposits received",lambda i:f"={AS(r_jn,i)}*{AS(r_dpj,i)}")
    f_dout=crow("customer deposits refunded",lambda i:f"=-{AS(r_ret,i)}*{AS(r_dpj,i)}")
    f_tp =crow("corporate tax PAID (quarterly)",lambda i:(f"=-IF(MOD({i+1},3)=0,-SUM('P&L'!{gcl(3+i-2)}{p_tax}:'P&L'!{gcl(3+i)}{p_tax}),0)" ))
    f_cap=crow("capital expenditure",lambda i:f"=-{AS(r_capex,i)}")
    f_net=crow("NET MOVEMENT IN CASH",lambda i:f"={gcl(3+i)}{f_cfo}+{gcl(3+i)}{f_din}+{gcl(3+i)}{f_dout}+{gcl(3+i)}{f_tp}+{gcl(3+i)}{f_cap}",bold=True)
    f_op =crow("Opening cash",lambda i:(f"={AC(r_ocash)}" if i==0 else f"={gcl(2+i)}{f_net}+{gcl(2+i)}{{OPENPREV}}"),tot=False)
    for i in range(12):
        ws3.cell(f_op,3+i, f"={AC(r_ocash)}" if i==0 else f"={gcl(2+i)}{f_op}+{gcl(2+i)}{f_net}")
    f_cl =crow("CLOSING CASH",lambda i:f"={gcl(3+i)}{f_op}+{gcl(3+i)}{f_net}",bold=True,fill=CALC,tot=False)
    f_fl =crow("Minimum cash floor (policy)",lambda i:f"={AC(r_floor)}",tot=False)
    f_hd =crow("HEADROOM over the floor",lambda i:f"={gcl(3+i)}{f_cl}-{gcl(3+i)}{f_fl}",bold=True,tot=False)
    f_al =crow("ALARM",lambda i:f'=IF({gcl(3+i)}{f_cl}<{gcl(3+i)}{f_fl},"BREACH","ok")','General',bold=True,fill=WARN,tot=False)
    r+=1
    ws3.cell(r,1,"Closing cash INCLUDES customers' refundable deposits. Cash genuinely ours = closing cash less the deposit liability on the balance sheet.").font=ITAL
    r+=1
    ws3.cell(r,1,"Cash genuinely the company's",).font=BOLD
    for i in range(12):
        c=ws3.cell(r,3+i,f"={gcl(3+i)}{f_cl}-'BALANCE SHEET'!{gcl(3+i)}{b_dep2}"); c.number_format=NUM; c.font=BOLD

    # patch balance-sheet cash + tax payable refs now that cash flow rows exist
    for i in range(12):
        ws2.cell(b_cash,3+i, f"='CASH FLOW'!{gcl(3+i)}{f_cl}")
        ws2.cell(b_tax,3+i, f"=-SUM('P&L'!$C${p_tax}:'P&L'!{gcl(3+i)}{p_tax})+SUM('CASH FLOW'!$C${f_tp}:'CASH FLOW'!{gcl(3+i)}{f_tp})")

    # ================= BREAK-EVEN =================
    ws4=wb.create_sheet("BREAK-EVEN"); widths(ws4)
    ws4.cell(1,1,"BREAK-EVEN").font=H1
    ws4.cell(2,1,"Management accounting — jars per day needed to cover costs").font=ITAL
    r=4; r=months(ws4,r)
    def krow(label,unit,f,fmt=DEC,bold=False,fill=None):
        nonlocal r
        ws4.cell(r,1,label); ws4.cell(r,2,unit).font=ITAL
        if bold: ws4.cell(r,1).font=BOLD
        for i in range(12):
            c=ws4.cell(r,3+i,f(i)); c.number_format=fmt
            if bold: c.font=BOLD
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        rr=r; r+=1; return rr
    k_con=krow("Contribution per unit","UGX",lambda i:f"={AS(r_rpu,i)}-{AS(r_cpu,i)}",bold=True)
    k_f1 =krow("Fixed costs — cash (opex + salaries)","UGX",lambda i:f"={AS(r_fix,i)}+{AS(r_sal,i)}",NUM)
    k_f2 =krow("  plus depreciation","UGX",lambda i:f"={AC(r_plant)}/{AC(r_life)}",NUM)
    k_f3 =krow("  plus jar programme","UGX",lambda i:f"={AS(r_jn,i)}*{AS(r_jc,i)}",NUM)
    k_b1 =krow("Cash break-even — excl jar programme","jars/day",lambda i:f"={gcl(3+i)}{k_f1}/{gcl(3+i)}{k_con}/{AS(r_days,i)}",'#,##0')
    k_b2 =krow("Full break-even — excl jar programme","jars/day",lambda i:f"=({gcl(3+i)}{k_f1}+{gcl(3+i)}{k_f2})/{gcl(3+i)}{k_con}/{AS(r_days,i)}",'#,##0')
    k_b3 =krow("Cash break-even — INCL jar programme","jars/day",lambda i:f"=({gcl(3+i)}{k_f1}+{gcl(3+i)}{k_f3})/{gcl(3+i)}{k_con}/{AS(r_days,i)}",'#,##0')
    k_b4 =krow("FULL BREAK-EVEN — INCL jar programme","jars/day",lambda i:f"=({gcl(3+i)}{k_f1}+{gcl(3+i)}{k_f2}+{gcl(3+i)}{k_f3})/{gcl(3+i)}{k_con}/{AS(r_days,i)}",'#,##0',bold=True)
    k_pl =krow("Planned output","jars/day",lambda i:f"={AS(r_jpd,i)}*{AC(r_floor)}/{AC(r_floor)}",'#,##0')
    for i in range(12): ws4.cell(k_pl,3+i,f"={AS(r_jpd,i)}*{A}!{SCEN_LOCAL}")
    k_hd =krow("HEADROOM over full break-even","jars/day",lambda i:f"={gcl(3+i)}{k_pl}-{gcl(3+i)}{k_b4}",'#,##0',bold=True)
    k_al =krow("ALARM",""      ,lambda i:f'=IF({gcl(3+i)}{k_hd}<0,"BELOW BREAK-EVEN","ok")','General',bold=True,fill=WARN)
    r+=1
    ws4.cell(r,1,"Month 1 plans 500/day against a full break-even of 577/day. That is why Month 1 loses money. The whole risk sits in the first quarter, and it is a volume risk.").font=ITAL

    # ================= 13-WEEK CASH =================
    ws5=wb.create_sheet("13-WEEK CASH")
    ws5.column_dimensions['A'].width=46; ws5.column_dimensions['B'].width=14
    for i in range(13): ws5.column_dimensions[gcl(3+i)].width=14
    ws5.column_dimensions[gcl(16)].width=16
    ws5.freeze_panes="C1"
    ws5.cell(1,1,"13-WEEK ROLLING CASH FORECAST").font=H1
    ws5.cell(2,1,"Bragg priority #1 · CFO100 Session 5 · REBUILD IT EVERY MONDAY MORNING. Standing rule, no exceptions. Type over the seeds — this is a forecast you maintain, not a report you read.").font=ITAL
    r=4
    ws5.cell(r,1,"Week commencing").font=BOLD
    ws5.cell(r,2,"").font=BOLD
    for i in range(13):
        c=ws5.cell(r,3+i,f"W{i+1}"); c.font=BOLD; c.alignment=Alignment(horizontal="center"); c.border=BOX
    c=ws5.cell(r,16,"13-WK TOTAL"); c.font=BOLD; c.alignment=Alignment(horizontal="center"); c.border=BOX
    r+=1
    wk = (lambda vals: [round(sum(vals[:3])/13) for _ in range(13)])
    seed_rec  = wk([NET[i]*(1+UPL[i]) for i in range(3)])
    seed_dep  = wk(DEPR)
    seed_mat  = wk(COGS)
    seed_jar  = [round(JAR_N*JAR_C*3/13)]*13
    seed_sal  = wk(SAL)
    seed_fix  = [round(FIXED*3/13)]*13
    seed_txn  = [round(sum(NET[i]*(1+UPL[i])*TXN_PCT for i in range(3))/13)]*13
    seed_ura  = wk(VATX)
    SUM13="=SUM(C{r}:O{r})"
    def wrow(label,unit,vals,fmt=NUM,bold=False,inp=False,formula=None,fill=None,tot=True):
        nonlocal r
        ws5.cell(r,1,label); ws5.cell(r,2,unit).font=ITAL
        if bold: ws5.cell(r,1).font=BOLD
        for i in range(13):
            c=ws5.cell(r,3+i, formula(i) if formula else (None if blank else (vals[i] if vals else None)))
            c.number_format=fmt
            if bold: c.font=BOLD
            if inp: c.fill=PatternFill("solid",fgColor=IN)
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        if tot:
            c=ws5.cell(r,16,SUM13.format(r=r)); c.number_format=fmt; c.font=BOLD
        rr=r; r+=1; return rr
    w_op=wrow("OPENING CASH","UGX",None,bold=True,tot=False,
              formula=lambda i:(f"={AC(r_ocash)}" if i==0 else f"={gcl(2+i)}{r+2+11}"))
    r=sect(ws5,r,"RECEIPTS")
    w_r1=wrow("Cash sales — refill and single-use","UGX",seed_rec,inp=True)
    w_r2=wrow("Jar deposits received","UGX",seed_dep,inp=True)
    w_r3=wrow("Input VAT refunds from URA","UGX",[0]*13,inp=True)
    w_r4=wrow("Other receipts / financing drawdown","UGX",[0]*13,inp=True)
    w_rt=wrow("TOTAL RECEIPTS","UGX",None,bold=True,formula=lambda i:f"=SUM({gcl(3+i)}{w_r1}:{gcl(3+i)}{w_r4})")
    r=sect(ws5,r,"PAYMENTS")
    w_p1=wrow("Raw materials and packaging","UGX",seed_mat,inp=True)
    w_p2=wrow("Jar purchases","UGX",seed_jar,inp=True)
    w_p3=wrow("Salaries, wages, PAYE and NSSF","UGX",seed_sal,inp=True)
    w_p4=wrow("Fixed operating costs","UGX",seed_fix,inp=True)
    w_p5=wrow("Transaction fees","UGX",seed_txn,inp=True)
    w_p6=wrow("URA — VAT and excise","UGX",seed_ura,inp=True)
    w_p7=wrow("URA — corporate tax","UGX",[0]*13,inp=True)
    w_p8=wrow("Jar deposit REFUNDS","UGX",[0]*13,inp=True)
    w_p9=wrow("Capex and other","UGX",[0]*13,inp=True)
    w_pt=wrow("TOTAL PAYMENTS","UGX",None,bold=True,formula=lambda i:f"=SUM({gcl(3+i)}{w_p1}:{gcl(3+i)}{w_p9})")
    r+=1
    w_nm=wrow("NET MOVEMENT","UGX",None,bold=True,formula=lambda i:f"={gcl(3+i)}{w_rt}-{gcl(3+i)}{w_pt}")
    w_cl=wrow("CLOSING CASH","UGX",None,bold=True,fill=CALC,tot=False,
              formula=lambda i:f"={gcl(3+i)}{w_op}+{gcl(3+i)}{w_nm}")
    for i in range(13):
        ws5.cell(w_op,3+i, f"={AC(r_ocash)}" if i==0 else f"={gcl(2+i)}{w_cl}")
    w_fl=wrow("Minimum cash floor (policy)","UGX",None,tot=False,formula=lambda i:f"={AC(r_floor)}")
    w_hd=wrow("HEADROOM","UGX",None,bold=True,tot=False,formula=lambda i:f"={gcl(3+i)}{w_cl}-{gcl(3+i)}{w_fl}")
    w_al=wrow("ALARM","",None,fmt='General',bold=True,fill=WARN,tot=False,
              formula=lambda i:f'=IF({gcl(3+i)}{w_cl}<{gcl(3+i)}{w_fl},"BREACH","ok")')
    r+=1
    for t in ["Seeds are months 1-3 of the plan divided evenly across 13 weeks. They are a STARTING POINT, not a forecast.",
              "THE STANDING RULE: every Monday morning, before anything else, roll this forward one week and type what you actually expect to receive and pay. Then read the ALARM row.",
              "Renew's own Accounting and Finance Team Checklist puts this on the Finance Manager as a WEEKLY duty: 'Prepare a weekly cash collection and disbursement plan and share with all finance staff (13 weeks cash flow)'.",
              "Jar deposits received are NOT revenue. They are in here because they are cash, and cash is what this tab is about.",
              "Jar deposit REFUNDS is a row on purpose. It is currently zero and it will not stay zero."]:
        ws5.cell(r,1,t).font=ITAL; r+=1

    # ================= 13-MONTH CASH (Renew shape) =================
    ws8=wb.create_sheet("13-MONTH CASH")
    ws8.column_dimensions['A'].width=46; ws8.column_dimensions['B'].width=16
    for i in range(13): ws8.column_dimensions[gcl(3+i)].width=15
    ws8.freeze_panes="C1"
    ws8.cell(1,1,"ROLLING 13-MONTH CASH FLOW FORECAST").font=H1
    ws8.cell(2,1,"Direct method, in Renew Capital's Session 5 shape. The 13-week tab answers TIMING. This tab answers PACE — can we afford the hiring step and the expansion?").font=ITAL
    r=4
    ws8.cell(r,1,"Month").font=BOLD
    for i in range(13):
        c=ws8.cell(r,3+i,f"M{i+1}"); c.font=BOLD; c.alignment=Alignment(horizontal="center"); c.border=BOX
    r+=1
    # month index i -> assumption column: months 1..12 map to C..N, month 13 reuses N
    def ac(rr,i): return f"{A}!{gcl(3+min(i,11))}{rr}"
    def mrow(label,f,fmt=NUM,bold=False,fill=None,indent=False):
        nonlocal r
        ws8.cell(r,1,("   " if indent else "")+label)
        if bold: ws8.cell(r,1).font=BOLD
        for i in range(13):
            c=ws8.cell(r,3+i,f(i)); c.number_format=fmt
            if bold: c.font=BOLD
            if fill: c.fill=PatternFill("solid",fgColor=fill)
        rr=r; r+=1; return rr
    m_op=mrow("OPENING BALANCE",lambda i:None,bold=True)
    ws8.cell(r,1,"Cash In").font=BOLD; r+=1
    m_i1=mrow("Cash sales — refill and single-use (VAT-inclusive)",
              lambda i:f"={ac(r_un,i)}*{ac(r_rpu,i)}*(1+{ac(r_upl,i)})",indent=True)
    m_i2=mrow("Jar deposits received",lambda i:f"={ac(r_jn,i)}*{ac(r_dpj,i)}",indent=True)
    m_i3=mrow("Financing / other cash in",lambda i:0,indent=True)
    m_it=mrow("Total Cash In",lambda i:f"=SUM({gcl(3+i)}{m_i1}:{gcl(3+i)}{m_i3})",bold=True)
    ws8.cell(r,1,"Cash Out").font=BOLD; r+=1
    m_o1=mrow("Raw materials and packaging",lambda i:f"={ac(r_un,i)}*{ac(r_cpu,i)}",indent=True)
    m_o2=mrow("Jar purchases",lambda i:f"={ac(r_jn,i)}*{ac(r_jc,i)}",indent=True)
    m_o3=mrow("Payroll",lambda i:f"={ac(r_sal,i)}",indent=True)
    m_o4=mrow("Fixed operating costs",lambda i:f"={ac(r_fix,i)}",indent=True)
    m_o5=mrow("Transaction fees",lambda i:f"={gcl(3+i)}{m_i1}*{ac(r_txn,i)}",indent=True)
    m_o6=mrow("URA — VAT and excise",lambda i:f"={ac(r_un,i)}*{ac(r_rpu,i)}*{ac(r_upl,i)}",indent=True)
    m_o7=mrow("URA — corporate tax (quarterly)",
              lambda i:(f"=IF(MOD({i+1},3)=0,-SUM('P&L'!{gcl(3+min(i,11)-2)}{p_tax}:'P&L'!{gcl(3+min(i,11))}{p_tax}),0)"),indent=True)
    m_o8=mrow("Jar deposit REFUNDS",lambda i:f"={ac(r_ret,i)}*{ac(r_dpj,i)}",indent=True)
    m_o9=mrow("Capex / one-time spending",lambda i:f"={ac(r_capex,i)}",indent=True)
    m_ot=mrow("Total Cash Out",lambda i:f"=SUM({gcl(3+i)}{m_o1}:{gcl(3+i)}{m_o9})",bold=True)
    m_nt=mrow("Net Cash Flow",lambda i:f"={gcl(3+i)}{m_it}-{gcl(3+i)}{m_ot}",bold=True)
    m_cl=mrow("CLOSING BALANCE",lambda i:f"={gcl(3+i)}{m_op}+{gcl(3+i)}{m_nt}",bold=True,fill=CALC)
    for i in range(13):
        ws8.cell(m_op,3+i, f"={AC(r_ocash)}" if i==0 else f"={gcl(2+i)}{m_cl}")
    m_th=mrow("Minimum Cash Threshold",lambda i:f"={AC(r_floor)}")
    m_ab=mrow("Cash Above / (Below) Minimum",lambda i:f"={gcl(3+i)}{m_cl}-{gcl(3+i)}{m_th}",bold=True)
    m_al=mrow("ALARM",lambda i:f'=IF({gcl(3+i)}{m_ab}<0,"BELOW MINIMUM","ok")','General',bold=True,fill=WARN)
    r+=1
    m_dep=mrow("memo: of which customers' refundable deposits",
               lambda i:"="+"+".join(f"({A}!{gcl(3+min(k,11))}{r_jn}-{A}!{gcl(3+min(k,11))}{r_ret})*{A}!{gcl(3+min(k,11))}{r_dpj}" for k in range(i+1)))
    m_own=mrow("memo: cash genuinely OURS",lambda i:f"={gcl(3+i)}{m_cl}-{gcl(3+i)}{m_dep}",bold=True)
    r+=1
    for tx in ["Month 13 repeats Month 12's assumptions. Replace it the moment you have a Year-2 view.",
               "THE STRUCTURAL QUESTION: set the hiring step (ASSUMPTIONS) to 0 and watch the closing balance. Then set it back.",
               "That difference is what the hire costs in cash. Renew: 'the fix here is not a timing trick, it's a decision about the pace of expansion.'",
               "Closing balance INCLUDES customers' deposits. The memo rows below strip them out. Manage to the OURS line, not the closing line."]:
        ws8.cell(r,1,tx).font=ITAL; r+=1

    # ================= RATIOS =================
    ws6=wb.create_sheet("RATIOS"); widths(ws6)
    ws6.cell(1,1,"KEY RATIOS — the four families").font=H1
    ws6.cell(2,1,"CFO100 Session 3 · these are FORECAST ratios. Say so before anyone else does.").font=ITAL
    r=4
    def rr_(label,formula,fmt,rule):
        nonlocal r
        ws6.cell(r,1,label); c=ws6.cell(r,3,formula); c.number_format=fmt; c.font=BOLD
        ws6.cell(r,4,rule).font=ITAL; r+=1
    ws6.column_dimensions['D'].width=44
    r=sect(ws6,r,"PROFITABILITY")
    rr_("Gross profit margin",f"='P&L'!O{p_gp}/'P&L'!O{p_net}",PCT,"Higher is better")
    rr_("EBITDA margin",f"='P&L'!O{p_ebd}/'P&L'!O{p_net}",PCT,"Higher is better")
    rr_("Pre-tax margin",f"='P&L'!O{p_ebit}/'P&L'!O{p_net}",PCT,"5% life support · 10% floor · 15% healthy")
    rr_("Net profit margin",f"='P&L'!O{p_np}/'P&L'!O{p_net}",PCT,"Higher is better")
    rr_("Return on assets (ROA)",f"='P&L'!O{p_np}/AVERAGE('BALANCE SHEET'!C{b_ta}:N{b_ta})",PCT,"FORECAST — not an achievement")
    rr_("Return on equity (ROE)",f"='P&L'!O{p_np}/AVERAGE('BALANCE SHEET'!C{b_te}:N{b_te})",PCT,"FORECAST — not an achievement")
    r+=1; r=sect(ws6,r,"LIQUIDITY — at Month 12")
    rr_("Current ratio",f"=('BALANCE SHEET'!N{b_cash}+'BALANCE SHEET'!N{b_inv}+'BALANCE SHEET'!N{b_rec})/'BALANCE SHEET'!N{b_tl}",'0.00"x"',"Ideal 1.5x - 3.0x")
    rr_("Quick ratio",f"=('BALANCE SHEET'!N{b_cash}+'BALANCE SHEET'!N{b_rec})/'BALANCE SHEET'!N{b_tl}",'0.00"x"',"Above 1.0x")
    rr_("Cash ratio",f"='BALANCE SHEET'!N{b_cash}/'BALANCE SHEET'!N{b_tl}",'0.00"x"',"Ideally 1.0x")
    rr_("Deposits as % of closing cash",f"='BALANCE SHEET'!N{b_dep2}/'BALANCE SHEET'!N{b_cash}",PCT,"How much of our cash is NOT ours")
    r+=1; r=sect(ws6,r,"EFFICIENCY")
    rr_("Asset turnover",f"='P&L'!O{p_net}/AVERAGE('BALANCE SHEET'!C{b_ta}:N{b_ta})",'0.00"x"',"Higher is better")
    rr_("Days inventory outstanding (DIO)",f"=AVERAGE({A}!C{r_dio}:{A}!N{r_dio})",'0.0"d"',"")
    rr_("Days sales outstanding (DSO)",f"=AVERAGE({A}!C{r_dso}:{A}!N{r_dso})",'0.0"d"',"Zero today. Will not stay zero.")
    rr_("Days payable outstanding (DPO)",f"=AVERAGE({A}!C{r_dpo}:{A}!N{r_dpo})",'0.0"d"',"Zero today. Suppliers give no credit.")
    rr_("Cash conversion cycle",f"=AVERAGE({A}!C{r_dio}:{A}!N{r_dio})+AVERAGE({A}!C{r_dso}:{A}!N{r_dso})-AVERAGE({A}!C{r_dpo}:{A}!N{r_dpo})",'0.0"d"',"Shorter is better")
    r+=1; r=sect(ws6,r,"CASH")
    rr_("Lowest cash point in the year",f"=MIN('CASH FLOW'!C{f_cl}:N{f_cl})",NUM,"The thinnest the company ever gets")
    rr_("Month of lowest cash",f"=MATCH(MIN('CASH FLOW'!C{f_cl}:N{f_cl}),'CASH FLOW'!C{f_cl}:N{f_cl},0)",'"M"0',"")
    rr_("Cash genuinely ours at M12",f"='CASH FLOW'!N{f_cl}-'BALANCE SHEET'!N{b_dep2}",NUM,"Closing cash less customer deposits")
    rr_("Free cash flow (Year 1)",f"='CASH FLOW'!O{f_cfo}+'CASH FLOW'!O{f_cap}",NUM,"Operating cash flow less capex")

    # ================= CHECKS =================
    ws7=wb.create_sheet("CHECKS")
    ws7.column_dimensions['A'].width=52; ws7.column_dimensions['B'].width=22; ws7.column_dimensions['C'].width=22; ws7.column_dimensions['D'].width=46
    ws7.cell(1,1,"INTEGRITY CHECKS").font=H1
    r=3
    ws7.cell(r,1,"Check").font=BOLD; ws7.cell(r,2,"Model").font=BOLD; ws7.cell(r,3,"Source / target").font=BOLD; ws7.cell(r,4,"Verdict").font=BOLD; r+=1
    checks=[("Balance sheet balances (max abs CHECK row)",f"=MAX(ABS('BALANCE SHEET'!C{b_chk}),ABS('BALANCE SHEET'!N{b_chk}))",0,NUM),
            ("Year-1 net revenue",f"='P&L'!O{p_net}",1807859712,NUM),
            ("Year-1 net profit",f"='P&L'!O{p_np}",227423239,NUM),
            ("Lowest cash point",f"=MIN('CASH FLOW'!C{f_cl}:N{f_cl})",17548449,NUM),
            ("M1 contribution per unit",f"=C{k_con}",1616.82,DEC),
            ("M1 full break-even incl jar (jars/day)",f"=C{k_b4}",577,'#,##0'),
            ("M12 customer deposits",f"='BALANCE SHEET'!N{b_dep2}",157038750,NUM)]
    for lbl,f,tgt,fmt in checks:
        ws7.cell(r,1,lbl); c=ws7.cell(r,2,f); c.number_format=fmt
        ws7.cell(r,3,tgt).number_format=fmt
        v_=ws7.cell(r,4,f'=IF(ABS(B{r}-C{r})<=MAX(1,ABS(C{r})*0.01),"OK","CHECK — variance "&TEXT(B{r}-C{r},"#,##0"))')
        v_.font=BOLD; v_.fill=PatternFill("solid",fgColor=WARN); r+=1
    r+=1
    ws7.cell(r,1,"WHAT IS INPUT AND WHAT IS DERIVED").font=BOLD; r+=1
    for t in ["EXACT, from the published Year-1 model: net revenue, cost of sales, VAT+excise, inventories,",
              "  deposits received, salaries, fixed costs, transaction fees, plant, depreciation, tax, opening balances.",
              "DERIVED HERE, replace when you know better: jars/day for M2-M11 (straight-line between the",
              "  published 500/day at M1 and 2,000/day at M12). Revenue and cost per unit follow from that ramp.",
              "SET TO ZERO ON PURPOSE, because the truth is unknown and a guess would be worse:",
              "  jar returns and refunds · trade receivables · trade payables · capex · input VAT refund timing.",
              "NOT IN THIS MODEL AT ALL: NSSF employer at the statutory 10% (recorded at 5%), Local Service Tax.",
              "",
              "If a CHECK row above says OK, this workbook reproduces the published model. If you then change an",
              "assumption, it will stop matching — that is the point. The published model was a snapshot. This one moves."]:
        ws7.cell(r,1,t).font=ITAL if not t.startswith(("EXACT","DERIVED","SET TO","NOT IN")) else BOLD; r+=1
    return wb

import sys
out="/tmp/claude-0/-home-user-CFO-system/cd2fa95c-2c80-5c87-9b34-511d1297fa04/scratchpad/build/"
build(False).save(out+"MajiSafi_OneSite_Model.xlsx")
build(True).save(out+"MajiSafi_OneSite_BLANK.xlsx")
print("built both")
