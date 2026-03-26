from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT_DIR / "data"
STATEMENT_PERIOD = "01-Apr-2021 to 31-Mar-2025"
STATEMENT_AS_ON = "31-Mar-2025"
REGISTERED_OFFICE = (
	"Rayala Towers, 158 Anna Salai, 7th Floor, Chennai - 600002"
)

CAMS_BLUE = colors.HexColor("#123A73")
CAMS_GREY = colors.HexColor("#EFF3F8")
SECTION_GREY = colors.HexColor("#DDE5EF")
GRID_GREY = colors.HexColor("#B9C4D3")
TEXT_GREY = colors.HexColor("#4A5568")
SUCCESS_GREEN = colors.HexColor("#1F7A1F")
LOSS_RED = colors.HexColor("#8C1D18")
WHITE = colors.white

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


@dataclass(frozen=True)
class InvestorProfile:
	filename: str
	name: str
	pan: str
	email: str
	age: int
	profile_label: str
	funds: list[dict]


def register_fonts() -> str:
	global FONT_REGULAR, FONT_BOLD

	candidates = [
		(
			Path("C:/Windows/Fonts/arial.ttf"),
			Path("C:/Windows/Fonts/arialbd.ttf"),
		),
		(
			Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
			Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
		),
	]

	for regular_path, bold_path in candidates:
		if regular_path.exists() and bold_path.exists():
			pdfmetrics.registerFont(TTFont("CAMS-Regular", str(regular_path)))
			pdfmetrics.registerFont(TTFont("CAMS-Bold", str(bold_path)))
			FONT_REGULAR = "CAMS-Regular"
			FONT_BOLD = "CAMS-Bold"
			return "₹"

	return "Rs."


def add_months(source_date: date, months: int) -> date:
	month_index = source_date.month - 1 + months
	year = source_date.year + month_index // 12
	month = month_index % 12 + 1
	day = min(source_date.day, monthrange(year, month)[1])
	return date(year, month, day)


def format_date(value: date) -> str:
	return value.strftime("%d-%b-%Y")


def format_amount(symbol: str, value: float) -> str:
	return f"{symbol}{value:,.2f}"


def generate_purchase_transactions(
	*,
	start_date: date,
	count: int,
	amount: float,
	start_nav: float,
	nav_step: float,
	nav_wobble: Iterable[float],
	transaction_type: str,
	spacing_months: int = 1,
) -> list[dict]:
	transactions = []
	unit_balance = 0.0
	wobble_values = list(nav_wobble)

	for index in range(count):
		trade_date = add_months(start_date, index * spacing_months)
		nav = round(start_nav + (index * nav_step) + wobble_values[index % len(wobble_values)], 2)
		units = round(amount / nav, 3)
		unit_balance = round(unit_balance + units, 3)
		transactions.append(
			{
				"date": trade_date,
				"type": transaction_type,
				"amount": amount,
				"signed_amount": amount,
				"units": units,
				"nav": nav,
				"unit_balance": unit_balance,
			}
		)

	return transactions


def add_redemption(
	transactions: list[dict],
	*,
	redemption_date: date,
	nav: float,
	units: float,
) -> None:
	current_balance = transactions[-1]["unit_balance"]
	if units >= current_balance:
		raise ValueError("Redemption units must be lower than the current unit balance.")

	remaining_units = round(current_balance - units, 3)
	amount = round(units * nav, 2)
	transactions.append(
		{
			"date": redemption_date,
			"type": "Redemption",
			"amount": amount,
			"signed_amount": -amount,
			"units": -units,
			"nav": nav,
			"unit_balance": remaining_units,
		}
	)


def sum_signed_amount(transactions: list[dict]) -> float:
	return round(sum(item["signed_amount"] for item in transactions), 2)


def current_units(transactions: list[dict]) -> float:
	return round(transactions[-1]["unit_balance"], 3)


def build_profiles() -> list[InvestorProfile]:
	aggressive_funds = [
		{
			"scheme": "HDFC Mid-Cap Opportunities Fund - Regular Plan - Growth",
			"amc": "HDFC Mutual Fund",
			"folio": "9201845/18",
			"current_nav": 182.46,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 4, 5),
				count=15,
				amount=10000,
				start_nav=118.45,
				nav_step=3.85,
				nav_wobble=[0.0, 1.35, -0.65, 1.9, -0.25],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "Parag Parikh Flexi Cap Fund - Regular Plan - Growth",
			"amc": "PPFAS Mutual Fund",
			"folio": "3485127/04",
			"current_nav": 76.82,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 4, 12),
				count=12,
				amount=15000,
				start_nav=54.25,
				nav_step=1.45,
				nav_wobble=[0.0, 0.55, -0.2, 0.8, -0.15],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "Axis Small Cap Fund - Regular Plan - Growth",
			"amc": "Axis Mutual Fund",
			"folio": "7712054/66",
			"current_nav": 105.33,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 7, 11),
				count=10,
				amount=5000,
				start_nav=68.15,
				nav_step=2.95,
				nav_wobble=[0.0, 1.1, -0.7, 1.6],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "Mirae Asset Large Cap Fund - Regular Plan - Growth",
			"amc": "Mirae Asset Mutual Fund",
			"folio": "6409182/27",
			"current_nav": 91.48,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 8, 8),
				count=8,
				amount=8000,
				start_nav=63.45,
				nav_step=2.1,
				nav_wobble=[0.0, 0.7, -0.3, 0.95],
				transaction_type="SIP",
			),
		},
	]

	moderate_funds = [
		{
			"scheme": "SBI Bluechip Fund - Regular Plan - Growth",
			"amc": "SBI Mutual Fund",
			"folio": "1158702/09",
			"current_nav": 88.62,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 4, 7),
				count=20,
				amount=12000,
				start_nav=61.4,
				nav_step=1.02,
				nav_wobble=[0.0, 0.45, -0.2, 0.55, -0.1],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "ICICI Pru Balanced Advantage Fund - Regular Plan - Growth",
			"amc": "ICICI Prudential Mutual Fund",
			"folio": "5623071/44",
			"current_nav": 35.27,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 5, 15),
				count=15,
				amount=10000,
				start_nav=27.8,
				nav_step=0.33,
				nav_wobble=[0.0, 0.18, -0.08, 0.12],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "Axis ELSS Tax Saver Fund - Regular Plan - Growth",
			"amc": "Axis Mutual Fund",
			"folio": "4489510/72",
			"current_nav": 32.48,
			"transactions": generate_purchase_transactions(
				start_date=date(2022, 4, 11),
				count=12,
				amount=12500,
				start_nav=21.65,
				nav_step=0.72,
				nav_wobble=[0.0, 0.35, -0.15, 0.42],
				transaction_type="SIP",
			),
		},
		{
			"scheme": "HDFC Short Term Debt Fund - Regular Plan - Growth",
			"amc": "HDFC Mutual Fund",
			"folio": "8204761/31",
			"current_nav": 29.14,
			"transactions": generate_purchase_transactions(
				start_date=date(2023, 4, 20),
				count=5,
				amount=50000,
				start_nav=25.8,
				nav_step=0.48,
				nav_wobble=[0.0, 0.05, -0.03],
				transaction_type="Purchase",
				spacing_months=4,
			),
		},
	]

	conservative_elss_transactions = generate_purchase_transactions(
		start_date=date(2021, 3, 12),
		count=6,
		amount=12500,
		start_nav=18.45,
		nav_step=1.15,
		nav_wobble=[0.0, 0.2, -0.12],
		transaction_type="Purchase",
		spacing_months=3,
	)
	add_redemption(
		conservative_elss_transactions,
		redemption_date=date(2025, 2, 7),
		nav=30.92,
		units=420.0,
	)

	conservative_funds = [
		{
			"scheme": "HDFC Corporate Bond Fund - Regular Plan - Growth",
			"amc": "HDFC Mutual Fund",
			"folio": "2841650/56",
			"current_nav": 47.84,
			"transactions": generate_purchase_transactions(
				start_date=date(2022, 6, 10),
				count=10,
				amount=25000,
				start_nav=37.15,
				nav_step=0.82,
				nav_wobble=[0.0, 0.1, -0.06],
				transaction_type="Purchase",
				spacing_months=3,
			),
		},
		{
			"scheme": "SBI Magnum Gilt Fund - Regular Plan - Growth",
			"amc": "SBI Mutual Fund",
			"folio": "6017943/13",
			"current_nav": 69.58,
			"transactions": generate_purchase_transactions(
				start_date=date(2022, 7, 15),
				count=8,
				amount=20000,
				start_nav=54.2,
				nav_step=1.24,
				nav_wobble=[0.0, 0.22, -0.11],
				transaction_type="Purchase",
				spacing_months=4,
			),
		},
		{
			"scheme": "Axis ELSS Tax Saver Fund - Regular Plan - Growth",
			"amc": "Axis Mutual Fund",
			"folio": "1159087/62",
			"current_nav": 31.88,
			"note": "Lock-in expired; one partial redemption recorded in Feb 2025.",
			"transactions": conservative_elss_transactions,
		},
	]

	return [
		InvestorProfile(
			filename="sample_cams_aggressive.pdf",
			name="Aarav Mehta",
			pan="AANPM4521D",
			email="aarav.mehta@example.com",
			age=28,
			profile_label="Young aggressive investor",
			funds=aggressive_funds,
		),
		InvestorProfile(
			filename="sample_cams_moderate.pdf",
			name="Neha Iyer",
			pan="AGNPI6384Q",
			email="neha.iyer@example.com",
			age=38,
			profile_label="Mid-career moderate investor",
			funds=moderate_funds,
		),
		InvestorProfile(
			filename="sample_cams_conservative.pdf",
			name="Sanjay Kulkarni",
			pan="ACXPK7421N",
			email="sanjay.kulkarni@example.com",
			age=55,
			profile_label="Near-retirement conservative investor",
			funds=conservative_funds,
		),
	]


def build_styles() -> dict[str, ParagraphStyle]:
	return {
		"title": ParagraphStyle(
			"name",
			fontName=FONT_BOLD,
			fontSize=15,
			leading=19,
			textColor=CAMS_BLUE,
			alignment=TA_CENTER,
		),
		"subtitle": ParagraphStyle(
			"subtitle",
			fontName=FONT_REGULAR,
			fontSize=8.5,
			leading=11,
			textColor=TEXT_GREY,
			alignment=TA_CENTER,
		),
		"section": ParagraphStyle(
			"section",
			fontName=FONT_BOLD,
			fontSize=9.5,
			leading=12,
			textColor=CAMS_BLUE,
			alignment=TA_LEFT,
		),
		"small": ParagraphStyle(
			"small",
			fontName=FONT_REGULAR,
			fontSize=7.5,
			leading=10,
			textColor=TEXT_GREY,
		),
		"note": ParagraphStyle(
			"note",
			fontName=FONT_REGULAR,
			fontSize=7,
			leading=9,
			textColor=TEXT_GREY,
		),
	}


def profile_summary(profile: InvestorProfile, currency_symbol: str) -> Table:
	total_invested = round(
		sum(sum_signed_amount(fund["transactions"]) for fund in profile.funds),
		2,
	)
	current_value = round(
		sum(current_units(fund["transactions"]) * fund["current_nav"] for fund in profile.funds),
		2,
	)
	gain = round(current_value - total_invested, 2)

	rows = [
		["Profile", profile.profile_label],
		["Investor", f"{profile.name} (Age {profile.age})"],
		["Funds Covered", str(len(profile.funds))],
		["Net Invested", format_amount(currency_symbol, total_invested)],
		["Current Value", format_amount(currency_symbol, current_value)],
		["Unrealised Gain", format_amount(currency_symbol, gain)],
	]

	table = Table(rows, colWidths=[38 * mm, 58 * mm])
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (0, -1), SECTION_GREY),
				("BACKGROUND", (1, 0), (1, -1), WHITE),
				("GRID", (0, 0), (-1, -1), 0.4, GRID_GREY),
				("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
				("FONTNAME", (1, 0), (1, -1), FONT_REGULAR),
				("FONTSIZE", (0, 0), (-1, -1), 8),
				("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
				("TEXTCOLOR", (1, 5), (1, 5), SUCCESS_GREEN if gain >= 0 else LOSS_RED),
			]
		)
	)
	return table


def investor_info_table(profile: InvestorProfile) -> Table:
	rows = [
		["Investor Name", profile.name, "PAN", profile.pan],
		["Email", profile.email, "Statement Period", STATEMENT_PERIOD],
		["Investor Profile", profile.profile_label, "CAS As On", STATEMENT_AS_ON],
	]
	table = Table(rows, colWidths=[27 * mm, 63 * mm, 28 * mm, 60 * mm])
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, -1), WHITE),
				("BACKGROUND", (0, 0), (0, -1), SECTION_GREY),
				("BACKGROUND", (2, 0), (2, -1), SECTION_GREY),
				("GRID", (0, 0), (-1, -1), 0.4, GRID_GREY),
				("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
				("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
				("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
				("FONTSIZE", (0, 0), (-1, -1), 8),
			]
		)
	)
	return table


def header_block(profile: InvestorProfile, styles: dict[str, ParagraphStyle], currency_symbol: str) -> list:
	return [
		Paragraph("Computer Age Management Services Pvt Ltd", styles["title"]),
		Paragraph("Consolidated Account Statement", styles["title"]),
		Paragraph(REGISTERED_OFFICE, styles["subtitle"]),
		Spacer(1, 1.5 * mm),
		Paragraph(
			f"Statement Period: {STATEMENT_PERIOD}   |   CAS Generated On: {STATEMENT_AS_ON}",
			styles["subtitle"],
		),
		Spacer(1, 2 * mm),
		HRFlowable(width="100%", thickness=1.2, color=CAMS_BLUE),
		Spacer(1, 3 * mm),
		investor_info_table(profile),
		Spacer(1, 3 * mm),
		profile_summary(profile, currency_symbol),
		Spacer(1, 4 * mm),
	]


def fund_meta_table(fund: dict) -> Table:
	rows = [
		["AMC", fund["amc"], "Folio No.", fund["folio"]],
		["Registrar", "CAMS", "Plan / Option", "Regular / Growth"],
	]
	table = Table(rows, colWidths=[23 * mm, 69 * mm, 24 * mm, 62 * mm])
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (0, -1), SECTION_GREY),
				("BACKGROUND", (2, 0), (2, -1), SECTION_GREY),
				("GRID", (0, 0), (-1, -1), 0.4, GRID_GREY),
				("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
				("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
				("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
				("FONTSIZE", (0, 0), (-1, -1), 7.8),
			]
		)
	)
	return table


def transaction_table(fund: dict, currency_symbol: str) -> Table:
	rows = [[
		"Date",
		"Transaction Type",
		f"Amount ({currency_symbol})",
		"Units",
		"NAV",
		"Unit Balance",
	]]

	for txn in fund["transactions"]:
		rows.append(
			[
				format_date(txn["date"]),
				txn["type"],
				f"{txn['amount']:,.2f}",
				f"{txn['units']:.3f}",
				f"{txn['nav']:.2f}",
				f"{txn['unit_balance']:.3f}",
			]
		)

	table = Table(
		rows,
		colWidths=[24 * mm, 40 * mm, 30 * mm, 25 * mm, 22 * mm, 28 * mm],
		repeatRows=1,
	)
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, 0), CAMS_BLUE),
				("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
				("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
				("FONTNAME", (0, 1), (-1, -1), FONT_REGULAR),
				("GRID", (0, 0), (-1, -1), 0.35, GRID_GREY),
				("FONTSIZE", (0, 0), (-1, -1), 7.4),
				("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CAMS_GREY]),
				("ALIGN", (2, 0), (-1, -1), "RIGHT"),
				("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
			]
		)
	)
	return table


def fund_summary_table(fund: dict, currency_symbol: str) -> Table:
	net_invested = sum_signed_amount(fund["transactions"])
	closing_units = current_units(fund["transactions"])
	current_value = round(closing_units * fund["current_nav"], 2)
	gain = round(current_value - net_invested, 2)

	rows = [[
		f"Net Invested: {format_amount(currency_symbol, net_invested)}",
		f"Current NAV: {fund['current_nav']:.2f}",
		f"Closing Units: {closing_units:.3f}",
		f"Current Value: {format_amount(currency_symbol, current_value)}",
		f"Gain: {format_amount(currency_symbol, gain)}",
	]]

	table = Table(rows, colWidths=[36 * mm, 28 * mm, 34 * mm, 42 * mm, 34 * mm])
	table.setStyle(
		TableStyle(
			[
				("BACKGROUND", (0, 0), (-1, -1), CAMS_GREY),
				("GRID", (0, 0), (-1, -1), 0.4, GRID_GREY),
				("FONTNAME", (0, 0), (-1, -1), FONT_BOLD),
				("FONTSIZE", (0, 0), (-1, -1), 7.5),
				("TEXTCOLOR", (4, 0), (4, 0), SUCCESS_GREEN if gain >= 0 else LOSS_RED),
			]
		)
	)
	return table


def fund_block(fund: dict, styles: dict[str, ParagraphStyle], currency_symbol: str) -> list:
	section_style = ParagraphStyle(
		"fund_header",
		parent=styles["section"],
		fontSize=9,
		textColor=WHITE,
		backColor=CAMS_BLUE,
		borderPadding=4,
	)
	elements = [
		Paragraph(fund["scheme"], section_style),
		Spacer(1, 1.5 * mm),
		fund_meta_table(fund),
		Spacer(1, 1.5 * mm),
		transaction_table(fund, currency_symbol),
		Spacer(1, 1.2 * mm),
		fund_summary_table(fund, currency_symbol),
	]

	if fund.get("note"):
		elements.extend([Spacer(1, 1 * mm), Paragraph(fund["note"], styles["note"])])

	elements.extend([Spacer(1, 4 * mm)])
	return elements


def footer(canvas, doc) -> None:
	canvas.saveState()
	canvas.setStrokeColor(GRID_GREY)
	canvas.line(15 * mm, 12 * mm, A4[0] - 15 * mm, 12 * mm)
	canvas.setFont(FONT_REGULAR, 7)
	canvas.setFillColor(TEXT_GREY)
	canvas.drawString(15 * mm, 8 * mm, "Synthetic CAMS statement generated for testing and demo use.")
	canvas.drawRightString(A4[0] - 15 * mm, 8 * mm, f"Page {doc.page}")
	canvas.restoreState()


def build_pdf(profile: InvestorProfile, currency_symbol: str) -> Path:
	OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
	output_path = OUTPUT_DIR / profile.filename
	styles = build_styles()
	story = header_block(profile, styles, currency_symbol)

	for fund in profile.funds:
		story.extend(fund_block(fund, styles, currency_symbol))

	document = SimpleDocTemplate(
		str(output_path),
		pagesize=A4,
		leftMargin=12 * mm,
		rightMargin=12 * mm,
		topMargin=12 * mm,
		bottomMargin=18 * mm,
	)
	document.build(story, onFirstPage=footer, onLaterPages=footer)
	return output_path


def main() -> None:
	currency_symbol = register_fonts()
	for profile in build_profiles():
		output_path = build_pdf(profile, currency_symbol)
		print(f"Generated: {output_path}")


if __name__ == "__main__":
	main()
