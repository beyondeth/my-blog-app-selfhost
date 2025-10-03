# Privacy Policy

**Effective Date**: January 10, 2025

---

## 1. Overview

DevLog (hereinafter referred to as "the Company") values your privacy and complies with relevant laws including the Personal Information Protection Act, the Act on Promotion of Information and Communications Network Utilization and Information Protection, and the Act on Consumer Protection in Electronic Commerce.

This Privacy Policy describes the types of personal information collected during the use of our services, the purposes of collection and use, retention and usage periods, and destruction procedures.

---

## 2. Personal Information We Collect

### 2.1 Required Information

The following information is required for account registration and service use:

- **Email Address**: Account identification, login, and important notifications
- **Password**: Account security (encrypted storage)
- **Username**: Profile display within the service
- **Registration Date**: Account management

### 2.2 Optional Information

The following information may be optionally collected during service use:

- **Profile Image**: Profile display
- **Bio**: Self-introduction
- **Blog Information**: Blog name, description, slug
- **Post Information**: Post title, content, images

### 2.3 Automatically Collected Information

Information automatically collected during service use:

- **Service Usage Records**: Access logs, cookies, IP addresses
- **Device Information**: Browser type, OS information, device identifiers
- **Location Information**: Access country/region (IP-based)

### 2.4 OAuth Login Information

When using social login (Google, GitHub, Kakao):

- **Email Address**
- **Profile Image**
- **Username**
- **OAuth Provider ID**

---

## 3. Purpose of Collection and Use

### 3.1 Account Management

- Confirm registration intent and user identification
- Account creation and management
- Prevent fraudulent use and unauthorized access
- User communication and notifications

### 3.2 Service Provision

- Blog platform service provision
- Post creation, editing, and deletion features
- Comment and communication features
- File upload and storage services

### 3.3 Service Improvement

- Service usage statistics analysis
- Personalized service provision
- Service quality improvement and new service development

### 3.4 Marketing and Advertising

- Event and promotion information (with consent)
- Service-related information and benefits

---

## 4. Retention and Usage Period

### 4.1 Immediate Processing Upon Account Deletion

When a member requests account deletion:

- **Immediate Action**: Personal information masking and login blocking
- **Masked Data**: Email, username, profile image, password, bio

### 4.2 Legal Retention Obligations

Information retained for a certain period according to relevant laws:

#### Act on Consumer Protection in Electronic Commerce
- **Records on contracts or withdrawal**: 5 years
- **Records on payment and supply of goods**: 5 years
- **Records on consumer complaints or dispute resolution**: 3 years

#### Protection of Communications Secrets Act
- **Service usage records (access logs, IP addresses)**: 3 months

#### Personal Information Protection Act
- **Records for preventing fraudulent use**: 1 year

### 4.3 Automatic Data Destruction

#### Inactive Account Management
- **Accounts inactive for 1+ year**: Email notification 30 days before retention expiry
- **If no action after notification**: Automatic destruction on expiry date

#### Automatic Message Deletion
- **Deleted messages**: Complete deletion 30 days after sender deletion

#### Legal Retention After Account Deletion
- **With payment records**: Complete deletion after 5 years
- **With dispute records**: Complete deletion after 3 years
- **General user data**: Immediate masking with no legal retention obligation

---

## 5. Data Destruction Procedures and Methods

### 5.1 Destruction Procedure

1. **Soft Delete**: Immediate personal information masking and login blocking upon withdrawal request
2. **Background Processing**: Asynchronous queue processing for related data deletion
   - S3 file deletion
   - Related table CASCADE cleanup
   - Deletion log recording
3. **Legal Retention Management**: Legally required information stored separately in dedicated DB
4. **Complete Deletion**: Automatic complete deletion upon legal retention expiry

### 5.2 Destruction Method

- **Electronic Files**: Permanent deletion by irrecoverable methods
- **Paper Documents**: Shredding or incineration
- **Database**: `DELETE` query execution and backup data deletion

### 5.3 Destruction Verification

- **Deletion Log Recording**: All deletion operations are recorded in audit logs
- **Administrator Verification**: Monthly verification of automatic deletion of expired data

---

## 6. Provision to Third Parties

The Company does not provide personal information to external parties in principle. However, exceptions apply in the following cases:

1. When users have given prior consent
2. When required by law or requested by investigative agencies according to legal procedures

### 6.1 Partner Services

Personal information may be shared for the following service provision:

#### AWS S3 (File Storage)
- **Provided Items**: Uploaded files and metadata
- **Purpose**: File storage and transmission
- **Retention Period**: Until account deletion or file removal

#### Stripe (Payment Processing)
- **Provided Items**: Email, payment information
- **Purpose**: Subscription payment processing
- **Retention Period**: Legal retention period (5 years)

---

## 7. Security Measures

### 7.1 Technical Measures

- **Personal Information Encryption**: Passwords stored using bcrypt encryption
- **Access Control**: Access permission management for personal information processing systems
- **Security Program Installation**: Antivirus programs and firewall operation
- **HTTPS Communication**: Transmission encryption (TLS 1.3)

### 7.2 Administrative Measures

- **Personal Information Handler Training**: Regular training twice a year
- **Access Permission Management**: Application of principle of least privilege
- **Personal Information Processing Policy Establishment**: Internal management plan establishment and implementation

### 7.3 Physical Measures

- **Server Room Access Control**: Physical access restriction
- **Personal Information Storage Location Locking**: Separate storage and access restriction

---

## 8. User and Legal Representative Rights and Exercise Methods

### 8.1 Right to Request Access to Personal Information

Users can view or modify their personal information at any time.

- **Method**: Settings > Profile Settings menu
- **Processing**: Immediate provision (maximum 3 business days)

### 8.2 Right to Request Correction or Deletion

Users can request correction or deletion of personal information.

- **Method**: Settings > Profile Settings or Customer Center inquiry
- **Processing Period**: Within 7 days from request date

### 8.3 Right to Request Suspension of Processing

Users can request suspension of personal information processing.

- **Method**: Customer Center inquiry
- **Processing Period**: Within 10 days from request date

### 8.4 Right to Request Account Deletion

Users can delete their account at any time.

- **Method**: Settings > Delete Account
- **Processing**:
  1. Immediate personal information masking and login blocking
  2. Background deletion work processing
  3. Legally required data automatically deleted after retention period

---

## 9. Privacy Officer

### Privacy Officer

- **Name**: DevLog Privacy Officer
- **Email**: privacy@devlog.com
- **Phone**: (TBD)

### Privacy Department

- **Department**: Privacy Protection Team
- **Email**: privacy@devlog.com

---

## 10. Remedy for Rights Infringement

If you need to report or consult about personal information infringement, you can contact the following organizations:

- **Personal Information Infringement Report Center**: (without area code) 118 | https://privacy.kisa.or.kr
- **Personal Information Dispute Mediation Committee**: (without area code) 1833-6972 | https://www.kopico.go.kr
- **Supreme Prosecutors' Office Cybercrime Investigation Department**: (without area code) 1301 | https://www.spo.go.kr
- **National Police Agency Cyber Safety Bureau**: (without area code) 182 | https://cyberbureau.police.go.kr

---

## 11. Privacy Policy Changes

When there are additions, deletions, or modifications to this Privacy Policy due to changes in laws, policies, or security technology, we will notify you through our homepage at least 7 days before the effective date of the changes.

- **Announcement Date**: January 3, 2025
- **Effective Date**: January 10, 2025

---

## 12. Cookie Operation and Management

### 12.1 Purpose of Cookie Use

- **Auto Login**: Session maintenance for user convenience
- **Security**: JWT token storage (HttpOnly, Secure cookies)
- **Service Usage Statistics**: Visitor count and usage pattern analysis

### 12.2 Cookie Installation, Operation, and Rejection

- **Cookie Rejection Method**: Can block cookies in browser settings
- **Impact of Cookie Rejection**: Some services such as login may be restricted

---

**This policy is effective from January 10, 2025.**

DevLog Team
