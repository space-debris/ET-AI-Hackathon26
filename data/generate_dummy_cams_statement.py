"""
Dummy CAMS Consolidated Statement Generator
For FinSage AI - ET AI Hackathon 2026

Designed to match Track 9 judge scenario:
- 6 funds across 4 AMCs
- Deliberate overlap in Reliance, HDFC, Infosys across multiple funds
- Mix of direct and regular plans
- Varying XIRR performance

Usage:
	python data/generate_dummy_cams_statement.py

Dependency:
	pip install reportlab
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT_PATH = Path(__file__).parent / "sample_cams_detailed.pdf"

INVESTOR = {
	"name": "Rahul Sharma",
	"pan": "ABCPS1234R",
	"email": "rahul.sharma@email.com",
	"mobile": "98XXXXXXXX",
	"address": "B-42, Sector 15, Faridabad, Haryana - 121007",
	"statement_date": "31-Mar-2025",
	"period": "01-Apr-2020 to 31-Mar-2025",
}

FUNDS = [
	{
		"amc": "HDFC Mutual Fund",
		"scheme": "HDFC Top 100 Fund - Regular Plan - Growth",
		"folio": "1234567/89",
		"plan": "Regular",
		"isin": "INF179K01VV5",
		"expense_ratio": 1.68,
		"xirr_approx": "12.4%",
		"invested_amount": 100000,
		"closing_units": 177.511,
		"current_nav": 934.56,
		"closing_value": 165895.62,
		"top_holdings": ["Reliance Industries (9.2%)", "HDFC Bank (8.1%)", "Infosys (7.4%)"],
		"transactions": [
			{"date": "10-Apr-2020", "type": "Purchase (SIP)", "amount": 5000, "nav": 412.35, "units": 12.127},
			{"date": "10-Jun-2021", "type": "Purchase (SIP)", "amount": 5000, "nav": 548.76, "units": 9.112},
			{"date": "10-Dec-2022", "type": "Purchase (SIP)", "amount": 5000, "nav": 634.91, "units": 7.875},
			{"date": "10-Jun-2023", "type": "Purchase (SIP)", "amount": 5000, "nav": 712.45, "units": 7.020},
			{"date": "10-Sep-2024", "type": "Purchase (SIP)", "amount": 5000, "nav": 891.23, "units": 5.609},
		],
	},
	{
		"amc": "Nippon India Mutual Fund",
		"scheme": "Nippon India Large Cap Fund - Regular Plan - Growth",
		"folio": "9876543/21",
		"plan": "Regular",
		"isin": "INF204K01EY1",
		"expense_ratio": 1.72,
		"xirr_approx": "11.8%",
		"invested_amount": 76000,
		"closing_units": 1701.29,
		"current_nav": 89.45,
		"closing_value": 152190.41,
		"top_holdings": ["Reliance Industries (8.8%)", "Infosys (8.2%)", "HDFC Bank (7.9%)"],
		"transactions": [
			{"date": "15-Jul-2020", "type": "Purchase (Lumpsum)", "amount": 25000, "nav": 34.21, "units": 730.78},
			{"date": "15-Jul-2021", "type": "Purchase (SIP)", "amount": 3000, "nav": 47.23, "units": 63.52},
			{"date": "15-Apr-2022", "type": "Purchase (SIP)", "amount": 3000, "nav": 44.89, "units": 66.83},
			{"date": "15-Jul-2023", "type": "Purchase (SIP)", "amount": 3000, "nav": 66.45, "units": 45.15},
			{"date": "15-Jul-2024", "type": "Purchase (SIP)", "amount": 3000, "nav": 82.44, "units": 36.39},
		],
	},
	{
		"amc": "Axis Mutual Fund",
		"scheme": "Axis Bluechip Fund - Regular Plan - Growth",
		"folio": "5544332/11",
		"plan": "Regular",
		"isin": "INF846K01EW2",
		"expense_ratio": 1.64,
		"xirr_approx": "10.2%",
		"invested_amount": 120000,
		"closing_units": 2959.42,
		"current_nav": 61.23,
		"closing_value": 181245.84,
		"top_holdings": ["Infosys (9.5%)", "Reliance Industries (8.4%)", "HDFC Bank (7.6%)"],
		"transactions": [
			{"date": "01-Jan-2021", "type": "Purchase (Lumpsum)", "amount": 50000, "nav": 32.45, "units": 1541.60},
			{"date": "01-Jan-2022", "type": "Purchase (SIP)", "amount": 5000, "nav": 38.77, "units": 128.96},
			{"date": "01-Apr-2023", "type": "Purchase (SIP)", "amount": 5000, "nav": 45.67, "units": 109.52},
			{"date": "01-Oct-2023", "type": "Purchase (SIP)", "amount": 5000, "nav": 51.22, "units": 97.61},
			{"date": "01-Apr-2024", "type": "Purchase (SIP)", "amount": 5000, "nav": 57.34, "units": 87.20},
		],
	},
	{
		"amc": "Mirae Asset Mutual Fund",
		"scheme": "Mirae Asset Emerging Bluechip Fund - Direct Plan - Growth",
		"folio": "7788990/33",
		"plan": "Direct",
		"isin": "INF769K01EF6",
		"expense_ratio": 0.54,
		"xirr_approx": "15.7%",
		"invested_amount": 90000,
		"closing_units": 1048.11,
		"current_nav": 134.78,
		"closing_value": 141323.28,
		"top_holdings": ["ICICI Bank (8.9%)", "Axis Bank (7.3%)", "SBI (6.8%)"],
		"transactions": [
			{"date": "05-Mar-2021", "type": "Purchase (Lumpsum)", "amount": 30000, "nav": 68.44, "units": 438.31},
			{"date": "05-Sep-2021", "type": "Purchase (SIP)", "amount": 4000, "nav": 81.56, "units": 49.05},
			{"date": "05-Jun-2022", "type": "Purchase (SIP)", "amount": 4000, "nav": 72.44, "units": 55.22},
			{"date": "05-Jun-2023", "type": "Purchase (SIP)", "amount": 4000, "nav": 98.76, "units": 40.50},
			{"date": "05-Sep-2024", "type": "Purchase (SIP)", "amount": 4000, "nav": 127.56, "units": 31.36},
		],
	},
	{
		"amc": "HDFC Mutual Fund",
		"scheme": "HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth",
		"folio": "1234567/90",
		"plan": "Direct",
		"isin": "INF179KB1HO9",
		"expense_ratio": 0.72,
		"xirr_approx": "18.3%",
		"invested_amount": 47000,
		"closing_units": 535.84,
		"current_nav": 144.23,
		"closing_value": 77284.23,
		"top_holdings": ["Supreme Industries (4.8%)", "Persistent Systems (4.5%)", "Tube Investments (4.1%)"],
		"transactions": [
			{"date": "10-Aug-2022", "type": "Purchase (Lumpsum)", "amount": 20000, "nav": 72.34, "units": 276.56},
			{"date": "10-Feb-2023", "type": "Purchase (SIP)", "amount": 3000, "nav": 84.56, "units": 35.49},
			{"date": "10-Aug-2023", "type": "Purchase (SIP)", "amount": 3000, "nav": 98.78, "units": 30.37},
			{"date": "10-May-2024", "type": "Purchase (SIP)", "amount": 3000, "nav": 124.89, "units": 24.02},
			{"date": "10-Nov-2024", "type": "Purchase (SIP)", "amount": 3000, "nav": 138.44, "units": 21.67},
		],
	},
	{
		"amc": "Kotak Mahindra Mutual Fund",
		"scheme": "Kotak Flexi Cap Fund - Regular Plan - Growth",
		"folio": "3322110/55",
		"plan": "Regular",
		"isin": "INF174K01LS2",
		"expense_ratio": 1.58,
		"xirr_approx": "9.8%",
		"invested_amount": 38000,
		"closing_units": 852.37,
		"current_nav": 76.44,
		"closing_value": 65153.35,
		"top_holdings": ["HDFC Bank (8.1%)", "Reliance Industries (7.6%)", "Infosys (6.9%)"],
		"transactions": [
			{"date": "20-Apr-2020", "type": "Purchase (SIP)", "amount": 2000, "nav": 28.44, "units": 70.32},
			{"date": "20-Apr-2021", "type": "Purchase (SIP)", "amount": 2000, "nav": 39.22, "units": 51.00},
			{"date": "20-Jul-2022", "type": "Purchase (SIP)", "amount": 2000, "nav": 41.22, "units": 48.52},
			{"date": "20-Oct-2023", "type": "Purchase (SIP)", "amount": 2000, "nav": 59.78, "units": 33.46},
			{"date": "20-Oct-2024", "type": "Purchase (SIP)", "amount": 2000, "nav": 73.88, "units": 27.07},
		],
	},
]

CAMS_PURPLE = colors.HexColor("#4B0082")
CAMS_BLUE = colors.HexColor("#003087")
LIGHT_GREY = colors.HexColor("#F5F5F5")
MID_GREY = colors.HexColor("#CCCCCC")
WHITE = colors.white
ACCENT_GREEN = colors.HexColor("#006400")
ACCENT_RED = colors.HexColor("#8B0000")
ACCENT_ORANGE = colors.HexColor("#CC5500")


def build_styles():
	getSampleStyleSheet()
	return {
		"title": ParagraphStyle(
			"title",
			fontSize=18,
			leading=22,
			textColor=CAMS_BLUE,
			alignment=TA_CENTER,
			fontName="Helvetica-Bold",
		),
		"subtitle": ParagraphStyle("subtitle", fontSize=9, leading=12, alignment=TA_CENTER),
		"disclaimer": ParagraphStyle("disclaimer", fontSize=7, leading=10, alignment=TA_CENTER),
	}


def header_block(styles):
	elems = []
	elems.append(Paragraph("COMPUTER AGE MANAGEMENT SERVICES PVT. LTD.", styles["title"]))
	elems.append(
		Paragraph(
			"Registered Office: New No 10, Old No 178, MGR Salai, Nungambakkam, Chennai - 600034",
			styles["subtitle"],
		)
	)
	elems.append(HRFlowable(width="100%", thickness=2, color=CAMS_BLUE))
	elems.append(Spacer(1, 2 * mm))
	elems.append(
		Paragraph(
			f"Statement Period: {INVESTOR['period']} | Generated On: {INVESTOR['statement_date']}",
			styles["subtitle"],
		)
	)
	elems.append(Spacer(1, 3 * mm))
	return elems


def portfolio_summary_block():
	total_invested = sum(f["invested_amount"] for f in FUNDS)
	total_value = sum(f["closing_value"] for f in FUNDS)
	gain = total_value - total_invested
	gain_pct = (gain / total_invested) * 100
	data = [
		["Portfolio Summary", ""],
		["Investor", INVESTOR["name"]],
		["Funds", str(len(FUNDS))],
		["AMCs", "4"],
		["Total Invested", f"Rs. {total_invested:,.2f}"],
		["Total Value", f"Rs. {total_value:,.2f}"],
		["Total Gain", f"Rs. {gain:,.2f} ({gain_pct:.1f}%)"],
		["Approx Portfolio XIRR", "~12.1% p.a."],
	]
	table = Table(data, colWidths=[60 * mm, 120 * mm])
	table.setStyle(
		TableStyle(
			[
				("SPAN", (0, 0), (1, 0)),
				("BACKGROUND", (0, 0), (1, 0), CAMS_BLUE),
				("TEXTCOLOR", (0, 0), (1, 0), WHITE),
				("FONTNAME", (0, 0), (1, 0), "Helvetica-Bold"),
				("GRID", (0, 0), (-1, -1), 0.5, MID_GREY),
				("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREY, WHITE]),
				("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
				("FONTSIZE", (0, 0), (-1, -1), 8),
			]
		)
	)
	return [table, Spacer(1, 4 * mm)]


def fund_block(fund):
	elems = []
	elems.append(Paragraph(fund["scheme"], ParagraphStyle("h", fontSize=10, textColor=WHITE, backColor=CAMS_PURPLE, leftIndent=4)))
	elems.append(Spacer(1, 1 * mm))

	meta = Table(
		[[f"AMC: {fund['amc']}", f"Folio: {fund['folio']}", f"ISIN: {fund['isin']}", f"Plan: {fund['plan']}"]],
		colWidths=[45 * mm, 40 * mm, 45 * mm, 50 * mm],
	)
	meta.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY), ("GRID", (0, 0), (-1, -1), 0.3, MID_GREY), ("FONTSIZE", (0, 0), (-1, -1), 7)]))
	elems.append(meta)

	tx_data = [["Date", "Type", "Amount (Rs.)", "NAV", "Units"]]
	for t in fund["transactions"]:
		tx_data.append([t["date"], t["type"], f"{t['amount']:,.2f}", f"{t['nav']:.4f}", f"{t['units']:.3f}"])

	tx = Table(tx_data, colWidths=[28 * mm, 55 * mm, 32 * mm, 30 * mm, 30 * mm], repeatRows=1)
	tx.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, 0), CAMS_BLUE),
				("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
				("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
				("GRID", (0, 0), (-1, -1), 0.3, MID_GREY),
				("FONTSIZE", (0, 0), (-1, -1), 7),
			]
		)
	)
	elems.append(tx)

	gain = fund["closing_value"] - fund["invested_amount"]
	gain_pct = (gain / fund["invested_amount"]) * 100
	close = Table(
		[[
			f"Units: {fund['closing_units']:.3f}",
			f"Current NAV: Rs. {fund['current_nav']:.4f}",
			f"Invested: Rs. {fund['invested_amount']:,.2f}",
			f"Current Value: Rs. {fund['closing_value']:,.2f}",
			f"Gain: Rs. {gain:,.2f} ({gain_pct:.1f}%)",
		]],
		colWidths=[36 * mm, 36 * mm, 36 * mm, 36 * mm, 36 * mm],
	)
	close.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREY),
				("GRID", (0, 0), (-1, -1), 0.5, MID_GREY),
				("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
				("FONTSIZE", (0, 0), (-1, -1), 7),
				("TEXTCOLOR", (4, 0), (4, 0), ACCENT_GREEN if gain >= 0 else ACCENT_RED),
			]
		)
	)
	elems.append(close)
	elems.append(Spacer(1, 4 * mm))
	return elems


def overlap_block():
	rows = [
		["Stock", "Fund 1", "Fund 2", "Fund 3", "Fund 6", "Overlap Count"],
		["Reliance Industries", "9.2%", "8.8%", "8.4%", "7.6%", "4 Funds"],
		["HDFC Bank", "8.1%", "7.9%", "7.6%", "8.1%", "4 Funds"],
		["Infosys", "7.4%", "8.2%", "9.5%", "6.9%", "4 Funds"],
	]
	table = Table(rows, colWidths=[40 * mm, 30 * mm, 30 * mm, 30 * mm, 30 * mm, 20 * mm])
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, 0), ACCENT_ORANGE),
				("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
				("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
				("GRID", (0, 0), (-1, -1), 0.3, MID_GREY),
				("FONTSIZE", (0, 0), (-1, -1), 7),
				("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GREY, WHITE]),
			]
		)
	)
	return [table, Spacer(1, 3 * mm)]


def disclaimer_block(styles):
	return [
		HRFlowable(width="100%", thickness=1, color=MID_GREY),
		Spacer(1, 2 * mm),
		Paragraph(
			"DISCLAIMER: This statement is synthetic test data for ET AI Hackathon 2026. "
			"It does not constitute investment advice. Consult a SEBI-registered advisor "
			"for personalized financial planning.",
			styles["disclaimer"],
		),
	]


def build_pdf():
	OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
	doc = SimpleDocTemplate(
		str(OUTPUT_PATH),
		pagesize=A4,
		rightMargin=15 * mm,
		leftMargin=15 * mm,
		topMargin=15 * mm,
		bottomMargin=15 * mm,
	)

	styles = build_styles()
	story = []
	story += header_block(styles)
	story += portfolio_summary_block()
	for fund in FUNDS:
		story += fund_block(fund)
	story += overlap_block()
	story += disclaimer_block(styles)

	doc.build(story)

	total_invested = sum(f["invested_amount"] for f in FUNDS)
	total_value = sum(f["closing_value"] for f in FUNDS)
	print(f"[OK] Dummy CAMS statement saved to: {OUTPUT_PATH}")
	print(f"Funds: {len(FUNDS)} | AMCs: 4")
	print(f"Total Invested: Rs. {total_invested:,.2f}")
	print(f"Total Value: Rs. {total_value:,.2f}")
	print(f"Total Gain: Rs. {total_value - total_invested:,.2f}")


if __name__ == "__main__":
	build_pdf()
