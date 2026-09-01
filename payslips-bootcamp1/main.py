from fastapi import FastAPI, Request, Form, Header, HTTPException, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
import uvicorn
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime
import os
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
import io
from dotenv import load_dotenv
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import base64
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, Attachment, FileContent, FileName, FileType, Disposition
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

# Load environment variables
load_dotenv()

app = FastAPI()

# Create static directory if it doesn't exist
static_dir = Path("static")
static_dir.mkdir(exist_ok=True)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Google Sheets setup
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SHEET_NAME = os.getenv('SHEET_NAME', 'Sheet1')
RANGE_NAME = f'{SHEET_NAME}!A:E'

# Column headers
HEADERS = [
    'Invoice No',
    'Student Name',
    'Course Fees',
    'Payment Date',
    'Email',
    'Receipt Status'
]

# Register DM Sans font
pdfmetrics.registerFont(TTFont('DMSans', 'fonts/DMSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DMSans-Bold', 'fonts/DMSans-Bold.ttf'))

EMAIL_USER = os.getenv("EMAIL_USER")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.sendgrid.net")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
CC_USER = os.getenv("CC_USER")
RECEIPT_API_KEY = os.getenv("RECEIPT_API_KEY")

def verify_api_key(x_api_key: str = Header(None)):
    if not RECEIPT_API_KEY or x_api_key != RECEIPT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

def get_service_account_info():
    encoded = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON_B64')
    if not encoded:
        raise RuntimeError('GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not configured')
    return json.loads(base64.b64decode(encoded).decode('utf-8'))

def get_google_sheets_service():
    creds = service_account.Credentials.from_service_account_info(
        get_service_account_info(), scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    return service

def initialize_sheet():
    """Initialize the sheet with headers if they don't exist"""
    service = get_google_sheets_service()
    
    # Check if headers exist
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f'{SHEET_NAME}!A1:E1'
    ).execute()
    
    # If no headers exist, add them
    if 'values' not in result:
        body = {
            'values': [HEADERS]
        }
        service.spreadsheets().values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=f'{SHEET_NAME}!A1:E1',
            valueInputOption='RAW',
            body=body
        ).execute()

def get_next_invoice_number_from_sheet(service, spreadsheet_id, range_name):
    # Fetch all rows
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()
    values = result.get('values', [])
    if len(values) <= 1:  # Only header exists
        last_number = 1280
    else:
        last_invoice = values[-1][0]  # First column is Invoice No
        try:
            last_number = int(last_invoice.split('-')[1])
        except Exception:
            last_number = 1280
        last_number += 1
    return f"CR-{last_number:05d}"

def generate_pdf(name, amount, invoice_number):
    # Create receipts directory if it doesn't exist
    receipts_dir = Path("receipts")
    receipts_dir.mkdir(exist_ok=True)
    
    # Generate filename using name only
    safe_name = name.replace(" ", "_")
    output_filename = f"{safe_name}_Payment_Slip.pdf"
    output_path = receipts_dir / output_filename
    
    # Remove existing file if it exists
    if output_path.exists():
        output_path.unlink()
    
    # Read the template PDF
    template_path = Path("pdf_template.pdf")
    template_pdf = PdfReader(str(template_path))
    output_pdf = PdfWriter()
    
    # Get the first page of the template
    page = template_pdf.pages[0]
    
    # Create a new PDF with ReportLab to add text
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    # Add name with DM Sans Bold font, size 12, after 'Bill to:'
    can.setFont("DMSans-Bold", 12)
    can.setFillColor(colors.white)  # Ensure the name is white
    name_x = 420 # Start after 'Bill to:' label
    name_y = 674  # Position below the address and aligned with 'Bill to:'
    can.drawString(name_x, name_y, name)
    
    # Add date in format '12-jun-2025' at (150, 648)
    current_date = datetime.now().strftime("%d-%b-%Y")
    can.setFont("DMSans", 12)
    can.setFillColor(colors.white)
    can.drawString(150, 648, current_date)
    
    # Add invoice number just below the date at (150, 628)
    can.setFont("DMSans", 12)
    can.drawString(150, 632, invoice_number)
    
    # Format amount with commas
    formatted_amount = f"Rs {int(amount):,}"
    
    # Draw amount at four positions (template for user to update positions)
    positions = [
        (330, 488),
        (440, 488),
        (440, 352),
        (440, 315),
    ]
    for idx, (x, y) in enumerate(positions):
        if idx == 3:
            can.setFont("DMSans-Bold", 16)
        else:
            can.setFont("DMSans", 14)
        can.drawString(x, y, formatted_amount)
    
    can.save()
    
    # Move to the beginning of the StringIO buffer
    packet.seek(0)
    
    # Create a new PDF with ReportLab
    new_pdf = PdfReader(packet)
    
    # Merge the template with the new PDF
    page.merge_page(new_pdf.pages[0])
    output_pdf.add_page(page)
    
    # Write the output PDF
    with open(output_path, "wb") as output_file:
        output_pdf.write(output_file)
    
    return output_path

def send_receipt_email(to_email, pdf_path, student_name, invoice_number):
    subject = "Your Payment Receipt - DataCrumbs Data Science Bootcamp"
    body = f"""
    Dear {student_name},

    Thank you for your payment to the DataCrumbs Data Science Bootcamp.

    Please find your payment slip attached to this email.
    Invoice Number: {invoice_number}

    If you have any questions, feel free to reply to this email.

    Best regards,
    DataCrumbs Team
    """

    sender_email = os.getenv('SENDER_EMAIL', 'no-reply@datacrumbs.com')

    message = Mail(
        from_email=Email(sender_email, "DataCrumbs Bootcamp"),
        to_emails=To(to_email),
        subject=subject,
        plain_text_content=body,
        bcc=[Email(sender_email)]
    )

    # Attach the PDF
    with open(pdf_path, "rb") as f:
        data = f.read()
        encoded = base64.b64encode(data).decode()
    attachedFile = Attachment(
        FileContent(encoded),
        FileName(os.path.basename(pdf_path)),
        FileType('application/pdf'),
        Disposition('attachment')
    )
    message.attachment = attachedFile

    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        response = sg.send(message)
        return response.status_code
    except Exception as e:
        print("SendGrid error:", e)
        return None

def send_receipt_email_smtp(to_email, pdf_path, student_name, invoice_number):
    subject = "Your Payment Receipt - DataCrumbs Data Science Bootcamp"
    plain_body = f"""
    Dear {student_name},

    Thank you for your payment to the DataCrumbs Data Science Bootcamp.

    Please find your payment slip attached to this email.
    Invoice Number: {invoice_number}

    If you have any questions, feel free to reply to this email.

    Best regards,
    DataCrumbs Team
    """
    html_body = f"""
    <html>
    <body style='font-family: Arial, sans-serif; background: #f9f9f9; color: #222;'>
        <div style='max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 32px;'>
            <h2 style='color: #2563eb;'>DataCrumbs Data Science Bootcamp</h2>
            <p>Dear <b>{student_name}</b>,</p>
            <p>Thank you for your payment to the <b>DataCrumbs Data Science Bootcamp</b>.</p>
            <p style='margin: 24px 0; background: #f1f5f9; padding: 16px; border-radius: 6px;'>
                <b>Your Invoice Number:</b> <span style='color: #059669;'>{invoice_number}</span>
            </p>
            <p>Please find your payment slip attached to this email.</p>
            <p>If you have any questions, feel free to reply to this email.</p>
            <br>
            <p style='color: #888;'>Best regards,<br>DataCrumbs Team</p>
        </div>
    </body>
    </html>
    """

    cc_list = [addr.strip() for addr in (CC_USER or "").split(",") if addr.strip()]

    msg = MIMEMultipart('alternative')
    msg["Subject"] = subject
    msg["From"] = EMAIL_USER
    msg["To"] = to_email
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    # Attach both plain and HTML bodies
    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Attach the PDF
    with open(pdf_path, "rb") as f:
        part = MIMEApplication(f.read(), Name=os.path.basename(pdf_path))
    part['Content-Disposition'] = f'attachment; filename="{os.path.basename(pdf_path)}"'
    msg.attach(part)

    # Send the email via SMTP (supports both SendGrid STARTTLS and Resend SSL)
    smtp_username = os.getenv("SMTP_USERNAME", "resend")
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(smtp_username, SENDGRID_API_KEY)
            server.sendmail(EMAIL_USER, [to_email, *cc_list], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(smtp_username, SENDGRID_API_KEY)
            server.sendmail(EMAIL_USER, [to_email, *cc_list], msg.as_string())

    # Delete the PDF after sending
    try:
        os.remove(pdf_path)
    except Exception as e:
        print(f"Could not delete PDF: {e}")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return HTMLResponse(content="Not found", status_code=404)

@app.post("/generate-receipt", dependencies=[Depends(verify_api_key)])
async def generate_receipt(name: str = Form(...), amount: float = Form(...), email: str = Form(...)):
    try:
        # Initialize sheet with headers
        initialize_sheet()
        
        # Store in Google Sheets
        service = get_google_sheets_service()
        current_date = datetime.now().strftime('%Y-%m-%d')
        invoice_number = get_next_invoice_number_from_sheet(service, SPREADSHEET_ID, RANGE_NAME)
        
        # Generate PDF
        pdf_path = generate_pdf(name, amount, invoice_number)
        
        # Save to Google Sheets (Invoice No as first column)
        values = [[invoice_number, name, amount, current_date, email, 'Generated']]
        body = {'values': values}
        service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID,
            range=RANGE_NAME,
            valueInputOption='RAW',
            body=body
        ).execute()
        
        # Send the PDF as an email
        send_receipt_email_smtp(email, pdf_path, name, invoice_number)
        
        # Return success response
        return Response(status_code=200)
        
    except Exception as e:
        print("Error in /generate-receipt:", e)
        return Response(status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)