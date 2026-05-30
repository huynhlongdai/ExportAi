# Monetization and Quota Spec

## Muc tieu

Tao mo hinh Free/Pro ro rang:

- Free co gia tri that, nhung co chu ky va gioi han hop ly.
- Pro mo khoa export khong chu ky, quota cao, automation, batch, preset nang cao.

## Free Plan

Tinh nang:

- Export Markdown, JSON, PDF, PNG.
- Co chu ky ExportAI Free.
- Gioi han 10 exports/day.
- Gioi han 50 exports/month.
- Toi da 2 formats moi lan export.
- Lich su export gioi han 20 task gan nhat.
- Khong automation/rules.
- Khong custom template nang cao.

## Pro Plan

Tinh nang:

- Khong chu ky.
- Export khong gioi han hoac quota cao theo chi phi ha tang.
- Batch export nhieu format.
- Automation/rules.
- Custom presets/templates.
- Lich su/archive lon hon.
- AI repair priority/debug support.

## Signature Policy

### Markdown

Cuoi file:

```md
---
Exported with ExportAI Free - upgrade to Pro to remove this signature.
```

### JSON

Trong `meta`:

```json
{
  "signature": "Exported with ExportAI Free",
  "proRequiredToRemoveSignature": true
}
```

### PDF

Footer nho:

```text
Exported with ExportAI Free - upgrade to Pro to remove this signature.
```

### PNG

Watermark nho goc duoi phai:

```text
ExportAI Free
```

## Quota Rules

Tinh mot export theo task thanh cong, khong theo format, trong MVP.

Sau nay co the tinh theo cost:

- Markdown: 1 unit
- JSON: 1 unit
- PDF: 2 units
- PNG long: 2 units
- Batch: tong unit cac format

## UI States

### Con quota

```text
Free plan
7/10 exports left today

[Export now] [Upgrade Pro]
```

### Het quota

```text
Daily export limit reached
You used 10/10 free exports today.

[Upgrade Pro] [Open Manager]
```

### User tat signature

```text
Remove ExportAI signature
Available in Pro

[Upgrade Pro] [Keep Free]
```

## License Architecture

### Ban dau

- Local free plan hard-coded.
- UI upgrade link mo landing/payment page.
- Signature/quota thuc thi local.

### Sau khi co backend

- User login/license key.
- Server validate license.
- Extension cache license trong `chrome.storage.local`.
- Grace period khi offline.
- Webhook tu payment provider cap nhat subscription.

## Payment Note

Khong nen dua vao Chrome Web Store Payments cu. Nen dung backend rieng ket hop Stripe, Paddle, Lemon Squeezy, hoac Merchant of Record tuong duong.

