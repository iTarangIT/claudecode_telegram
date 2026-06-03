# Dealer Onboarding Over WhatsApp — Simple Flow

This document explains the dealer onboarding process in simple business language.

The main idea is:

**Dealer uses WhatsApp. iTarang collects documents. The system reads and checks them. Dealer confirms the details. Sales Admin reviews and approves in the normal process.**

The flowcharts are included directly inside this document as simple text diagrams, so there is no separate diagram file to open.

Quick visual flow:

```text
Dealer on WhatsApp
        ↓
iTarang collects and saves documents
        ↓
System reads details from documents
        ↓
System verifies GST / PAN / bank details
        ↓
System fills the dealer onboarding application
        ↓
Dealer confirms the summary
        ↓
Sales Admin reviews in the normal panel
```

---

## 1. What We Are Building

Today, dealer onboarding depends on a form-based process where documents and details are collected manually.

The new process will let a dealer complete most of onboarding by simply chatting with the official iTarang WhatsApp number.

The dealer will:

- Send documents on WhatsApp.
- Answer missing questions on WhatsApp.
- Review a summary of their details.
- Confirm or correct the details.

After that, the application goes to the Sales Admin panel for review, exactly like the normal approval process.

---

## 2. Big Picture Flow

```text
+----------------+
| Dealer         |
| on WhatsApp    |
+----------------+
        |
        | Sends documents and basic details
        v
+-------------------------------+
| iTarang WhatsApp System       |
| - Collects documents          |
| - Saves original documents    |
| - Reads details from them     |
| - Checks details using APIs   |
+-------------------------------+
        |
        | Fills dealer onboarding information
        v
+-------------------------------+
| Dealer Reviews Summary        |
| - Company details             |
| - GST / PAN                   |
| - Bank details                |
| - Uploaded documents          |
+-------------------------------+
        |
        | Dealer confirms or corrects
        v
+-------------------------------+
| Sales Admin Panel             |
| - Reviews application         |
| - Checks documents            |
| - Approves / rejects / asks   |
|   for correction              |
+-------------------------------+
```

Simple sentence version:

```text
Dealer sends documents on WhatsApp
        ↓
iTarang saves and reads the documents
        ↓
iTarang checks GST, PAN, and bank details
        ↓
System fills the onboarding application
        ↓
Dealer confirms the final summary
        ↓
Sales Admin reviews in the existing panel
```

---

## 3. Dealer Experience Flow

This is what the dealer will experience.

```text
Dealer sends: "Hi" or "Start onboarding"
        ↓
Bot replies:
"Welcome to iTarang dealer onboarding.
We will collect your documents here."
        ↓
Bot asks for one document at a time:
"Please send your GST certificate."
        ↓
Dealer sends photo or PDF
        ↓
System saves the original document
        ↓
System reads the document
        ↓
System checks if details are clear and valid
        ↓
If document is OK:
    Bot asks for next document

If document is unclear or wrong:
    Bot asks dealer to resend or correct it
        ↓
After all documents are collected:
Bot sends a summary of all details
        ↓
Dealer replies:
    CONFIRM  → submit to Sales Admin
    CHANGE   → correct details first
        ↓
Application goes to Sales Admin for review
```

---

## 4. Sales Admin Review Flow

The Sales Admin process should remain familiar.

```text
New WhatsApp onboarding application arrives
        ↓
Application appears in Sales Admin review list
        ↓
Admin opens the application
        ↓
Admin sees:
    - Dealer company details
    - GST / PAN / bank details
    - All original documents
    - What the system extracted from documents
    - Verification status and warnings
        ↓
Admin takes decision:

    APPROVE
        ↓
    Dealer moves forward in the normal process

    REJECT
        ↓
    Dealer is informed

    ASK FOR CORRECTION
        ↓
    Dealer receives correction request on WhatsApp
        ↓
    Dealer sends corrected document/detail
        ↓
    Admin reviews again
```

---

## 5. Documents Collected

The WhatsApp bot should collect the same documents required in the current dealer onboarding workflow.

### Company and identity documents

- GST certificate
- Company PAN
- Company registration / business proof, if applicable
- Udyam certificate, if applicable

### Financial documents

- Bank statement
- Cancelled cheque or required cheque documents
- ITR documents, if required

### Owner / partner / director documents

- Owner photograph
- Partner photographs, if partnership
- Director photographs, if company
- Partnership deed, MoU, AoA, or other legal documents where required

### Details that may be asked separately

Some details may not be clearly available in the documents. The bot can ask the dealer directly for:

- Owner name
- Mobile number
- Email address
- Company type
- Business address confirmation
- Bank branch details
- Whether finance enablement is required
- Agreement language or signatory details, if required

---

## 6. What the System Does With Documents

For every document received on WhatsApp, the system should do four things.

```text
1. SAVE
   Keep the original document exactly as the dealer sent it.

2. READ
   Read important details from the document.
   Example: GST number, PAN number, bank account, IFSC.

3. CHECK
   Verify key details using available APIs.
   Example: GST check, PAN check, bank account check.

4. FILL
   Put the confirmed details into the dealer onboarding application.
```

Important: the system should not silently approve a dealer. It only prepares the application and helps Sales Admin review faster.

---

## 7. Dealer Confirmation Before Submission

Before the application goes to Sales Admin, the dealer should see a simple summary.

Example message:

```text
Please confirm your dealer onboarding details:

Company: ABC Motors
GST: 27ABCDE****1Z5
PAN: ABCDE****F
Bank: HDFC Bank
Account: XXXXXXXX1234
IFSC: HDFC****234
Documents received: GST, PAN, Bank Statement, Photo

Reply CONFIRM to submit.
Reply CHANGE if anything is wrong.
```

Sensitive numbers should be partly hidden in the WhatsApp summary.

The bot should also understand simple natural replies, not only exact keywords. For example:

- `CONFIRM`, `OK`, `YES`, `HAAN` should be treated as confirmation.
- `CHANGE`, `EDIT`, `WRONG`, `CORRECT` should open the correction flow.

Only after the dealer confirms should the application move to Sales Admin review.

---

## 8. What Happens If There Is A Problem

### If the photo or PDF is unclear

```text
System says:
"This document is not clear. Please resend a clearer photo or PDF."
```

### If the wrong document is sent

```text
System says:
"This does not look like a GST certificate.
Please send your GST certificate."
```

### If details do not match

Example: the bank account name does not match the company or owner name.

```text
System marks it as a warning.
Dealer may be asked to correct it.
Sales Admin will also see the warning during review.
```

Important rule:

```text
A failed GST / PAN / bank check should not secretly pass.
It should either:
  - ask the dealer for correction, or
  - go to Sales Admin with a clear warning.

Sales Admin makes the final decision.
```

### If the dealer stops responding

```text
Bot sends a reminder after some time.
Dealer can continue from where they left off.
If there is no response for too long, the session is marked incomplete.
```

### If the dealer wants to correct something

```text
Dealer replies: CHANGE
        ↓
Bot asks what needs to be changed
        ↓
Dealer sends corrected detail or document
        ↓
System updates the summary
        ↓
Dealer confirms again
```

---

## 9. What Stays the Same

This new process changes the way documents are collected, but it does not remove the existing approval control.

The following should stay the same:

- Sales Admin still reviews the dealer application.
- Sales Admin still approves, rejects, or asks for correction.
- Original documents are still saved.
- Dealer onboarding records are still populated in the main system.
- The application still merges into the normal dealer onboarding process after review.

In short:

```text
WhatsApp becomes the collection channel.
Sales Admin remains the approval authority.
```

---

## 10. Implementation Blocks in Simple Terms

The work can be divided into clear blocks.

### Block 1 — WhatsApp entry point

Receive dealer messages and documents from the official iTarang WhatsApp number.

### Block 2 — Document saving

Save every original document safely in the same document storage process used today.

### Block 3 — Document reading

Read key details from the documents:

- GST number
- PAN number
- Company name
- Business address
- Bank account number
- IFSC
- Owner or signatory details

### Block 4 — Verification

Check key details using APIs wherever available:

- GST verification
- PAN verification
- Bank account verification

### Block 5 — Application filling

Use the extracted and verified details to fill the dealer onboarding application.

### Block 6 — Dealer confirmation

Send the dealer a summary on WhatsApp and ask for final confirmation.

### Block 7 — Sales Admin handoff

Once confirmed, send the application to the Sales Admin review panel.

### Block 8 — Correction loop

If Sales Admin asks for a correction, notify the dealer on WhatsApp and collect the corrected document or detail.

---

## 11. End-to-End Flow in One View

```text
START
  |
  v
Dealer messages iTarang WhatsApp
  |
  v
Bot creates/opens dealer onboarding session
  |
  v
Bot asks for required documents one by one
  |
  v
Dealer sends documents
  |
  v
System stores original documents
  |
  v
System reads details from documents
  |
  v
System verifies GST / PAN / bank where possible
  |
  v
System fills onboarding application
  |
  v
Bot sends masked summary to dealer
  |
  v
Dealer confirms?
  |
  +---- No ----> Dealer corrects detail/document
  |                 |
  |                 v
  |              Summary sent again
  |
  +---- Yes ---> Application submitted to Sales Admin
                    |
                    v
                 Admin reviews
                    |
          +---------+----------+
          |         |          |
          v         v          v
       Approve   Reject   Ask Correction
          |         |          |
          v         v          v
       Normal    Dealer    Dealer fixes
       process   informed  on WhatsApp
```

---

## 12. Open Decisions

These are business decisions to confirm before implementation.

1. Which WhatsApp provider is final for inbound messages?
   - Existing system already supports WhatsApp sending through Gupshup.
   - We need to confirm inbound WhatsApp setup also uses the same provider.

2. Which documents are mandatory for each dealer type?
   - Sole proprietor
   - Partnership
   - LLP
   - Private limited company
   - Branch dealer

3. Should corrections happen fully on WhatsApp, or through the existing correction link?

4. Should the dealer agreement happen before Sales Admin review or after Sales Admin approval?

5. Who receives alerts when a new WhatsApp onboarding application is ready for review?

---

## 13. Optional Engineering Note

For engineers, the WhatsApp process should connect into the existing dealer onboarding and Sales Admin review system rather than creating a separate approval process.

The WhatsApp layer should only handle:

- conversation
- document collection
- extraction
- verification
- dealer confirmation
- handoff to Sales Admin

The final business decision should remain inside the normal Sales Admin review flow.
