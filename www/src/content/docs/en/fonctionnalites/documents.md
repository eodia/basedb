---
title: PDF documents
description: A row as an invoice, quote, sheet or certificate in your colors, with a logo, linked rows and totals.
---

A row becomes a **PDF**: an invoice with its lines and its total, a quote, a delivery note, a
product sheet, a certificate. In a row’s details, the **PDF document** button opens it in a
new tab, from which the browser prints or saves it.

## The sheet, with nothing to set up

Without a template, a row prints as a **sheet**: its name as the title, then every field you
can read, in your language.

## Create a template

Whoever builds the table — the Manage level — creates templates from a row’s details:
**PDF document › Document templates…**. A new template starts from a **starting point**:

| Starting point | What it sets up |
|---|---|
| **Invoice** | a header with logo and contact details, “INVOICE”, number and date; client; invoiced lines and their total; net / gross summary; payment terms; legal notices in the footer |
| **Quote** | a title on a colored band, information in a grid, services, validity, an “Approved” zone |
| **Record sheet** | a large full-width title, the image field’s photo, fields in a grid, long texts |
| **Certificate** | a framed landscape page, centered text, a signature |
| **Blank page** | a title and the row’s fields |

It is built with **your table’s columns** — its number, its date, its amounts, its photo, the
rows linked to it — and whatever the table doesn’t have is simply left out. Everything can be
changed afterwards; the preview, on the right, shows the PDF of the open row and updates with
every change.

## The content: blocks

The blocks follow one another from top to bottom; you **drag** them by their handle to reorder
them, and open them to set them up.

| Block | What it shows |
|---|---|
| **Heading** | a large title and a subtitle, plain, in color, underlined, or on a band — edge to edge of the page |
| **Text** | rich text — headings, bold, lists, links — that cites the row’s columns with the **Column** menu: "Invoice `{{numero}}` of `{{date}}`"; aligned or justified, on a tinted background, framed or marked with a colored bar |
| **Image** | a logo, a stamp, or the photo of an image field of the row |
| **Row fields** | the chosen fields, or all of them: label on the left, label above in a grid of 2 or 3, or **summary** — values on the right, the last one (the total due) in bold; empty fields can be hidden |
| **Table of linked rows** | the rows that point to this one — an invoice’s lines — or the ones a multiple relation points to, with their **totals**; colored header, every other row tinted, column headers, widths and alignments at your hand ("Qty" for "Quantity") |
| **Columns** | two or three columns side by side, each with its own blocks: "Bill to" on one side, the references on the other |
| **Separator**, **Space** | a line — short for a signature — or a blank |
| **Page break** | the rest on a new page |

## The style and the page

- **Accent color** — the one of your brand: headings, bands, table headers, links. Text
  placed on it is white or dark, whichever reads best.
- **Text color**, **font** of the text and of the titles (sans-serif or serif), **text size**,
  subheading style.
- **Page size** (A4 or Letter), **orientation**, **margins**, a single or double **border**
  around the page, content **centered vertically** — for a certificate.
- **Language of the values**: amounts are written with their currency ("1,234.50 €"), dates
  written out in full ("September 30, 2026"), yes and no, a choice’s label, a person’s name.
  The text is set in embedded fonts that cover basedb’s twenty languages, ideographic
  characters included.

## Header and footer

The **header** carries your **logo** — an uploaded image (PNG, JPEG or SVG; an oversized image
is shrunk) or the row’s image field —, a text on the left (your contact details) and a text on
the right (what the document is, its number, its date), on the first page or on every one. The
**footer** carries your legal notices and the page numbers. Both cite the row’s columns, like
a text block.

## Everyone with their own permissions

A document is read **with the permissions of whoever prints it**: a field hidden from them
does not appear there — neither in a text nor as an image —, a linked row they cannot see is
not in the table — nor in the total. Two people can therefore get two different documents from
the same row: each has their own.

## By the API

```bash
# A row’s PDF with a template, or a “sheet”
curl -H "Authorization: Bearer $TOKEN" -o facture.pdf \
  "$BASEDB/api/v1/$TENANT/data/ventes/factures/$ID/documents/$MODELE"
```

`GET …/data/{base}/{table}/documents` lists the table’s templates.

## Limits

- An uploaded image weighs 300 KB at most, eight per template; an image from a field is reused
  if it is a PNG or a JPEG.
- A value from a linked row is cited outside the table through a **lookup** on the document’s
  table; a gross total is a field of the table.
- One document per row: no multi-row PDF yet. An
  [automation](/basedb/en/fonctionnalites/automatisations/#a-pdf-and-an-email) can do it for
  you — **Generate a PDF** — and send it as an attachment.
