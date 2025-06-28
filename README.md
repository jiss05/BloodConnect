# 🩸 BloodConnect – Blood Donation Management System (Backend)

BloodConnect is a robust and scalable backend built using Node.js and MongoDB. It powers a comprehensive blood donation and management system for users, donors, hospitals, and administrators. Key functionalities include blood request processing, inventory tracking, donor registration, OTP-based authentication, and dynamic PDF report generation.

---

## 🚀 Features

- ✅ User & Hospital Staff Registration/Login with JWT
- 🔐 Secure OTP-based Password Reset
- 🧑‍⚕️ Donor Registration & Search
- 🏥 Blood Inventory Management (CRUD operations)
- 📍 Geolocation-based blood request matching using OpenStreetMap
- 📤 PDF generation for donor and inventory data
- 📧 Email integration for OTP and report delivery
- 📁 File serving through `/public` route
- 🔑 Role-based middleware protection for endpoints

---

## 🧱 Tech Stack

| Layer       | Technology                           |
|-------------|--------------------------------------|
| Runtime     | Node.js                              |
| Framework   | Express.js                           |
| Database    | MongoDB Atlas                        |
| Auth        | JWT, bcrypt, OTP                     |
| PDF         | pdfmake                              |
| Geolocation | OpenStreetMap Nominatim API          |
| Email       | Nodemailer with Gmail OAuth2         |
| Security    | Helmet, CORS                         |

---


## 📁 Project Structure
Backend  
│  
├── controllers/  
│   ├── config.gmail.env              # Gmail OAuth2 Config (Optional)  
│   ├── email.js                      # Email sending logic  
│   └── middleware.js                 # Role-based access control  
│  
├── fonts/  
│   ├── Roboto-Bold.ttf  
│   ├── Roboto-BoldItalic.ttf  
│   ├── Roboto-Italic.ttf  
│   └── Roboto-Regular.ttf  
│  
├── models/  
│   ├── doner.js                      # Donor schema  
│   ├── inventory.js                  # Blood inventory schema  
│   ├── login.js                      # Login & user base schema  
│   ├── otp.js                        # OTP storage schema  
│   ├── request.js                    # Blood request schema  
│   └── token.js                      # Password reset token schema  
│  
├── public/                           # Stores generated PDFs  
│  
├── routes/  
│   └── v1/  
│       ├── admin/  
│       │   └── admin.js              # Admin routes  
│       ├── enduser/  
│       │   └── enduser.js            # End user routes  
│       └── hospitalstaff/  
│           └── hospitalstaff.js      # Hospital staff routes  
│  
├── utils/  
│   ├── templates/  
│   │   └── emailtemplates.js         # Email template definitions  
│   ├── bloodgroupmatch.js            # Blood compatibility logic  
│   ├── generateBloodRequestPDF.js    # Generates requester PDF  
│   ├── generateInventoryListPDF.js   # Generates inventory PDF  
│   ├── generatePdf.js                # Blood match PDF (donor + hospital)  
│   ├── geocode.js                    # City-to-coordinates converter  
│   └── sms.js                        # Optional SMS notification utility  
│  
├── .env                              # Environment variables (JWT secret, Gmail creds)  
├── .gitignore  
├── index.js                          # Main server entry point  
├── package.json  
└── package-lock.json  

---


---

## 🔐 Authentication & OTP Flow

- Passwords are hashed using `bcrypt`
- JWTs are issued upon successful login and attached to protected routes
- Role-based access control is enforced via custom middleware:
  - `isAdmin`
  - `isUser`
  - `isHospitalStaff`
- OTP (One Time Password) System:
  - ✅ **Email Verification during user/hospital registration**
  - 🔁 **Forgot Password flow**
  - OTPs are sent via email and stored with timestamps
  - Verification ensures token expiration handling and prevents reuse


---

## 📦 Blood Inventory Management

Hospital staff can:
- Add or update blood group units
- View their current inventory
- View other hospitals’ inventories (PDF report)
- Delete specific blood groups or the whole inventory
- Contact number & city are stored and editable

Each inventory is geotagged using OpenStreetMap (Nominatim API) to support location-based matching.

---

## 📄 PDF Report Generation

- Donor list PDF (`generatePdf.js`)
- Inventory report PDF (`generateInventoryListPDF.js`)
- Blood request summary PDF (`generateBloodRequestPDF.js`)
- Stored in `public/` and downloadable via generated URL
- Emailed as attachments when necessary

---

## 🌐 API Base URL

http://localhost:4000/api/v1

---

## 🔀 Sample API Routes

### 🔓 Auth Routes


| Method | Endpoint                                 | Description                |
|--------|------------------------------------------|----------------------------|
| POST   | /admin/register                          | Admin registration         |
| POST   | /enduser/register                        | User registration          |
| POST   | /hospitalstaff/hospitalstaffregister     | Hospital staff register    |
| POST   | /enduser/login                           | User login                 |
| POST   | /hospitalstaff/hospitalstafflogin        | Hospital staff login       |


### 🔁 OTP Routes

| Method | Endpoint                                 | Description                        |
|--------|------------------------------------------|------------------------------------|
| POST   | /hospitalstaff/forgotpassword            | Send OTP                           |
| POST   | /hospitalstaff/verify-otp                | Verify OTP                         |
| POST   | /hospitalstaff/reset-password            | Reset password                     |


### 🧑‍⚕️ Donor Routes

| Method | Endpoint                                 | Description                                     |
|--------|------------------------------------------|-------------------------------------------------|
| POST   | /enduser/register-donor                  | Register as donor                               |
| GET    | /hospitalstaff/donors                    | Get all donors                                  |
| GET    | /hospitalstaff/donors/bygroup/:group     | Get donors by blood group (PDF emailed)         |


### 🩸 Blood Inventory Routes

| Method | Endpoint                                                       | Description                            |
|--------|----------------------------------------------------------------|----------------------------------------|
| POST   | /hospitalstaff/inventory/add                                   | Add or update blood units              |
| GET    | /hospitalstaff/viewinventory                                   | View your inventory                    |
| GET    | /hospitalstaff/getinventorylist                                | Get all other hospitals inventory (PDF)|
| PATCH  | /hospitalstaff/inventory/:id/contact                           | Update contact number                  |
| PATCH  | /hospitalstaff/inventory/:id/add-bloodgroup                    | Add a new blood group                  |
| PATCH  | /hospitalstaff/inventory/:id/bloodgroup/:group                 | Update blood group units               |
| DELETE | /hospitalstaff/inventory/:id/bloodgroup/:group                 | Delete blood group                     |
| DELETE | /hospitalstaff/inventory/:id                                   | Delete full inventory                  |


---

## 📍 Blood Request Matching

- Location of hospital and donors are matched within a **10 km radius**
- `utils/bloodMatcher.js` provides blood compatibility logic
- Matching results include:
  - Donors within 10 km
  - Hospital inventories within 10 km
- A PDF report is generated with the matches and emailed

---

## 📦 Setup Instructions

```bash
git clone https://github.com/yourusername/BloodConnect.git
cd Backend

npm install

# Create fonts folder and download Roboto fonts from Google Fonts:
mkdir fonts
# Place Roboto-Regular.ttf, Roboto-Bold.ttf, etc. in /fonts

# Create a /public folder for generated PDFs
mkdir public

# Start the server
node index.js


