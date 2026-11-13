// Terms, privacy and refund policy for the public site. Rendered by the app
// (src/vend/Legal.tsx) and written as static HTML by scripts/prerender.ts.
// No value imports: scripts/prerender.ts loads this file directly in Node.
import type { PageSeo } from './site';

const SITE_NAME = 'Zenerlink';
const COMPANY = 'Zieon Energies Ltd';
const COMPANY_RC = '9519634';
const SUPPORT_EMAIL = 'support@zieonenergies.com';

export const COMPANY_ADDRESS = '42, Crib Sankara, Banana Island, Jahi, Abuja, FCT, Nigeria';
export const LEGAL_UPDATED = '13 November 2026';

export type LegalDoc = PageSeo & { heading: string; intro: string; sections: [string, string[]][] };

const contact = `${COMPANY} (RC ${COMPANY_RC}), ${COMPANY_ADDRESS}. Email: ${SUPPORT_EMAIL}.`;

export const TERMS: LegalDoc = {
  path: '/terms',
  title: `Terms of Service | ${SITE_NAME}`,
  description: `The terms that apply when you use ${SITE_NAME} to buy prepaid electricity tokens and fund a wallet.`,
  heading: 'Terms of Service',
  intro: `${SITE_NAME} is a service of ${COMPANY}, a company registered in Nigeria (RC ${COMPANY_RC}). These terms apply when you create an account, fund a wallet or buy electricity on ${SITE_NAME}. By using the service you agree to them.`,
  sections: [
    ['The service', [
      `${SITE_NAME} lets you buy electricity tokens and pay bills for prepaid and postpaid meters on Nigerian electricity distribution companies (DisCos). We pass your purchase to the DisCo through our licensed vending partner and show you the token or receipt the DisCo returns.`,
      `We are not a DisCo. Your tariff, the units you receive per naira, metering, outages and estimated billing are set by your DisCo and the Nigerian Electricity Regulatory Commission, not by us.`,
    ]],
    ['Your account', [
      'You need an account to buy. Give a valid email address and keep your password private. You are responsible for purchases made from your account.',
      `Tell us at ${SUPPORT_EMAIL} straight away if you think someone else has used your account.`,
      'You must be at least 18 years old, or use the service with the permission of a parent or guardian.',
    ]],
    ['Meter details', [
      'Before you pay, we check the meter number with the DisCo and show you the name on the meter. Check it carefully. A token is tied to the meter it was bought for and cannot be moved to another meter.',
      'If you confirm a purchase for the wrong meter number, the DisCo will not reverse it, and we cannot refund it (see the Refund Policy).',
    ]],
    ['Prices and payment', [
      'You pay the amount you enter, plus any convenience fee, which is always shown before you pay. Your DisCo decides how many units that amount buys, after VAT and any outstanding charges on the meter. The unit estimate we show while you type is only a guide; your receipt shows the DisCo’s own figure.',
      'Card, bank transfer and USSD payments are processed by Paystack, a licensed payment processor. We never see or store your full card number.',
    ]],
    ['Wallet', [
      'You can add money to your wallet and pay for electricity from it. Your wallet balance is not a bank deposit and does not earn interest. It is held only to pay for purchases on ' + SITE_NAME + '.',
      'You can ask us to return an unused wallet balance at any time (see the Refund Policy).',
    ]],
    ['Delivery', [
      'Most tokens arrive within seconds. Sometimes a DisCo is slow or unavailable. When that happens your order shows as delayed and we keep trying. If we cannot get a token, we refund you.',
      'Your tokens and receipts stay in your account under Transactions.',
    ]],
    ['Acceptable use', [
      'Do not use the service for fraud, to pay with a card or account you are not allowed to use, to test stolen payment details, or to interfere with the service. We may suspend accounts and report activity to the authorities and our payment partners where we reasonably suspect fraud.',
    ]],
    ['Liability', [
      'We do our best to keep the service available and correct, but it depends on DisCos, payment providers and networks outside our control. To the extent the law allows, our liability for any purchase is limited to the amount you paid for it. Nothing in these terms limits your rights under the Federal Competition and Consumer Protection Act.',
    ]],
    ['Changes', [
      'We may update these terms. We will post the new version here with a new date, and tell you by email about important changes. If you keep using the service after a change, the new terms apply.',
    ]],
    ['Law and disputes', [
      'These terms are governed by the laws of the Federal Republic of Nigeria. If you have a complaint, contact us first and we will try to resolve it within 14 days. If we cannot, the courts of the Federal Capital Territory, Abuja, have jurisdiction.',
    ]],
    ['Contact', [contact]],
  ],
};

export const PRIVACY: LegalDoc = {
  path: '/privacy',
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `What personal data ${SITE_NAME} collects, why, who it is shared with and how to exercise your rights under the Nigeria Data Protection Act.`,
  heading: 'Privacy Policy',
  intro: `This policy explains how ${COMPANY} (“we”), which runs ${SITE_NAME}, handles your personal data. We are the data controller and we process your data in line with the Nigeria Data Protection Act 2023.`,
  sections: [
    ['What we collect', [
      'Account details: your email address and password (stored only as a secure hash), and your name and phone number if you add them.',
      'Meter details: the meter numbers you buy for or save, their DisCo, and the account name and address the DisCo returns for them.',
      'Transactions: what you bought, when, the amount, the token or receipt, and payment and wallet records.',
      'Technical data: your IP address, browser and device type, and logs of requests to our servers, used for security and to fix problems.',
    ]],
    ['Why we use it', [
      'To create and secure your account, check meter details, deliver your tokens, run your wallet, give refunds and answer support requests (performing our contract with you).',
      'To prevent fraud and keep records required by law, including tax and anti-money-laundering rules (legal obligation and legitimate interest).',
      'To send you receipts and important service messages. We will only send marketing if you agree to it, and you can opt out at any time.',
    ]],
    ['Who we share it with', [
      'Paystack, to process card, transfer and USSD payments.',
      'Our electricity vending partner and your DisCo, which receive the meter number, amount and the contact details needed to issue a token.',
      'Hosting and email providers that run the service for us, under contracts that protect your data.',
      'Regulators, law enforcement or courts, when the law requires it.',
      'We do not sell your personal data.',
    ]],
    ['Card data', [
      'Your card details are entered on Paystack’s secure checkout and are never stored on our servers.',
    ]],
    ['Cookies and storage', [
      'We keep you signed in by storing a session key in your browser. We do not use advertising trackers.',
    ]],
    ['How long we keep it', [
      'We keep your account data while your account is open. We keep transaction records for six years after the transaction, as required for tax and financial records, and then delete or anonymise them.',
    ]],
    ['Your rights', [
      'You can ask us for a copy of your data, to correct it, to delete your account, to object to or restrict how we use it, or to move it to another service. Email ' + SUPPORT_EMAIL + ' and we will reply within 30 days. We may need to keep some records the law requires even after you close your account.',
      'If you are unhappy with how we handle your data, you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng).',
    ]],
    ['Security', [
      'We use encryption in transit, hashed passwords and access controls to protect your data. If a breach puts your data at risk, we will tell you and the Commission as the law requires.',
    ]],
    ['Changes', [
      'We may update this policy and will post the new version here with a new date.',
    ]],
    ['Contact', [contact]],
  ],
};

export const REFUNDS: LegalDoc = {
  path: '/refunds',
  title: `Refund Policy | ${SITE_NAME}`,
  description: `When and how ${SITE_NAME} refunds failed electricity purchases and unused wallet balances.`,
  heading: 'Refund Policy',
  intro: 'You only pay for electricity you receive. This policy explains what happens when a purchase does not go through.',
  sections: [
    ['Failed purchases', [
      'If you pay and the DisCo does not issue a token, we refund you in full. You do not need to ask; this happens automatically once the purchase is confirmed as failed.',
      'If you paid from your wallet, the money returns to your wallet straight away. If you paid by card, transfer or USSD, it is refunded to your wallet where you have one, or to the original payment method, which usually takes 5 to 10 working days to show, depending on your bank.',
    ]],
    ['Delayed tokens', [
      'If a DisCo is slow, your order shows as delayed while we keep trying. You will not be charged twice. If the token cannot be delivered, the order is refunded as above.',
    ]],
    ['Purchases that cannot be refunded', [
      'Once a DisCo has issued a token, the purchase is complete and cannot be reversed, because the units are credited to that meter. This includes tokens bought for a wrong meter number that you confirmed, and tokens you have not yet loaded on your meter.',
      'If a token is rejected by your meter, contact us. We will check it with the DisCo and help you get it working, or arrange a replacement where the DisCo issued a faulty token.',
    ]],
    ['Unused wallet balance', [
      `You can ask for your unused wallet balance to be returned at any time. Email ${SUPPORT_EMAIL} from your account email. We pay it back to the card or bank account you funded it from within 7 working days.`,
    ]],
    ['Charged but no order?', [
      `If money left your account but no order appears in Transactions, email ${SUPPORT_EMAIL} with the date, amount and your payment reference. We will trace it and refund it or complete the purchase within 3 working days.`,
    ]],
    ['Contact', [contact]],
  ],
};

export const LEGAL_DOCS = [TERMS, PRIVACY, REFUNDS];
export const legalByPath = (path: string) => LEGAL_DOCS.find((d) => d.path === path);
