'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Phone,
  Film,
  Link2,
  FileText,
  Landmark,
  AlertCircle,
  Clock,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

const DRIVE_SHARE_EMAIL = 'maxxpixelsoffical@gmail.com';

const getApiBase = () =>
  (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');

interface ContentTypeOption {
  code: string;
  label: string;
}

interface LanguageOption {
  name: string;
  code: string;
}

interface SubmissionStatusData {
  id: number;
  title: string;
  contentType: string;
  language?: string;
  oneLineBrief?: string;
  producerName?: string;
  productionName?: string;
  producerContactPhone?: string;
  phoneVerified?: boolean;
  producerEmail?: string;
  posterUrl?: string;
  bannerUrl?: string;
  trailerUrl?: string;
  googleDriveLink?: string;
  status: string;
  agreementStatus?: string;
  agreementAccepted?: boolean;
  agreementSignedName?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  bankAccountHolder?: string;
  bankName?: string;
  reviewNotes?: string;
  bunnyTransferStatus?: string;
  createdAt?: string;
}

const FALLBACK_CONTENT_TYPES: ContentTypeOption[] = [
  { code: 'MOVIE', label: 'Movie' },
  { code: 'SHORT_FILM', label: 'Short Film' },
  { code: 'SERIES', label: 'Web Series' },
  { code: 'MICRODRAMA', label: 'Microdrama' },
  { code: 'ALBUM', label: 'Music / Album' },
  { code: 'PODCAST', label: 'Podcast' },
];

const FALLBACK_LANGUAGES: LanguageOption[] = [
  { name: 'Telugu', code: 'te' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Tamil', code: 'ta' },
  { name: 'Kannada', code: 'kn' },
  { name: 'Malayalam', code: 'ml' },
  { name: 'English', code: 'en' },
];

function isValidUrl(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed);
}

function CopyEmailBanner() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(DRIVE_SHARE_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-100 leading-relaxed">
          <p className="font-semibold text-amber-300">
            Important: Share Google Drive Access Before Submitting
          </p>
          <p className="text-amber-100/85 mt-0.5">
            Do not upload files here. Paste Google Drive links for your assets and grant{' '}
            <strong className="text-white">Viewer</strong> access to{' '}
            <code className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-xs">
              {DRIVE_SHARE_EMAIL}
            </code>
            .
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold transition shrink-0 cursor-pointer"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Email Copied' : 'Copy Email'}
      </button>
    </div>
  );
}

function StatusStepper({ status }: { status: string }) {
  const norm = (status || 'SUBMITTED').toUpperCase();
  const stepIndex =
    norm === 'ONBOARDED' || norm === 'APPROVED' || norm === 'PUBLISHED'
      ? 3
      : norm === 'KYC_SUBMITTED'
      ? 2
      : norm === 'KYC_PENDING'
      ? 1
      : 0;

  const steps = [
    { label: 'Details Submitted', desc: 'OTP verified & queued' },
    { label: 'Admin Review', desc: 'Details & Drive access check' },
    { label: 'Agreement & KYC', desc: 'Sign terms & submit docs' },
    { label: 'Onboarded', desc: 'Added to catalog draft' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {steps.map((s, idx) => {
        const completed = idx < stepIndex || norm === 'ONBOARDED';
        const active = idx === stepIndex && norm !== 'ONBOARDED' && norm !== 'REJECTED';
        return (
          <div
            key={s.label}
            className={`rounded-xl border p-3 transition ${
              completed
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : active
                ? 'border-red-500/60 bg-red-500/10'
                : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                  completed
                    ? 'bg-emerald-500 text-black'
                    : active
                    ? 'bg-red-600 text-white'
                    : 'bg-white/10 text-zinc-400'
                }`}
              >
                {completed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </span>
              <span className="text-xs font-semibold text-white">{s.label}</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 pl-8">{s.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

function CollectContentInner() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get('token')?.trim() || '';

  // Dynamic metadata options
  const [contentTypes, setContentTypes] = useState<ContentTypeOption[]>(FALLBACK_CONTENT_TYPES);
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);

  // --- Mode 1: New Submission State ---
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [otpMessage, setOtpMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [contentType, setContentType] = useState('MOVIE');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('Telugu');
  const [oneLineBrief, setOneLineBrief] = useState('');
  const [producerName, setProducerName] = useState('');
  const [productionName, setProductionName] = useState('');
  const [emailIds, setEmailIds] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [googleDriveLink, setGoogleDriveLink] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedResult, setSubmittedResult] = useState<{
    id: number;
    kycToken: string;
    trackingUrl: string;
  } | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // --- Mode 2: Token Status & Agreement/KYC State ---
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [submission, setSubmission] = useState<SubmissionStatusData | null>(null);

  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementSignedName, setAgreementSignedName] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDocLink, setAadhaarDocLink] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panDocLink, setPanDocLink] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankChequeLink, setBankChequeLink] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycError, setKycError] = useState('');
  const [kycSuccess, setKycSuccess] = useState('');

  // Load content types & languages dynamically from backend
  useEffect(() => {
    if (tokenParam) return;
    const base = getApiBase();
    fetch(`${base}/content-types`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (list.length > 0) {
          const mapped: ContentTypeOption[] = list
            .map((item: Record<string, unknown>) => {
              const code = String(item.code || item.slug || item.name || '').toUpperCase().replace(/\s+/g, '_');
              const label = String(item.name || item.label || item.code || '');
              return { code, label };
            })
            .filter((x: ContentTypeOption) => x.code && x.label);
          if (mapped.length > 0) {
            setContentTypes(mapped);
            setContentType(mapped[0].code);
          }
        }
      })
      .catch(() => {});

    fetch(`${base}/languages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (list.length > 0) {
          const mapped: LanguageOption[] = list
            .map((item: Record<string, unknown>) => ({
              name: String(item.name || item.label || ''),
              code: String(item.code || item.slug || item.name || ''),
            }))
            .filter((x: LanguageOption) => x.name);
          if (mapped.length > 0) {
            setLanguages(mapped);
            setLanguage(mapped[0].name);
          }
        }
      })
      .catch(() => {});
  }, [tokenParam]);

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const loadTokenStatus = useCallback(async (tok: string) => {
    setStatusLoading(true);
    setStatusError('');
    try {
      const res = await fetch(`${getApiBase()}/producer/collect/status/${encodeURIComponent(tok)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setStatusError(json?.message || 'Submission link not found or expired.');
        setSubmission(null);
      } else {
        setSubmission(json.data);
        if (json.data?.producerName && !agreementSignedName) {
          setAgreementSignedName(json.data.producerName);
        }
      }
    } catch {
      setStatusError('Unable to reach server. Please check your connection and try again.');
    } finally {
      setStatusLoading(false);
    }
  }, [agreementSignedName]);

  useEffect(() => {
    if (tokenParam) {
      loadTokenStatus(tokenParam);
    }
  }, [tokenParam, loadTokenStatus]);

  const handleSendOtp = async () => {
    setOtpMessage(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setOtpMessage({ type: 'err', text: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/producer/collect/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setOtpMessage({ type: 'err', text: json?.message || 'Failed to send OTP.' });
      } else {
        setOtpSent(true);
        setResendCooldown(30);
        setOtpMessage({ type: 'ok', text: 'OTP sent to your mobile number. Valid for 10 minutes.' });
      }
    } catch {
      setOtpMessage({ type: 'err', text: 'Network error while sending OTP.' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpMessage(null);
    if (otpCode.trim().length < 4) {
      setOtpMessage({ type: 'err', text: 'Enter the 6-digit OTP sent to your phone.' });
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch(`${getApiBase()}/producer/collect/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), otp: otpCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success || !json?.data?.otpToken) {
        setOtpMessage({ type: 'err', text: json?.message || 'Invalid or expired OTP.' });
      } else {
        setOtpToken(json.data.otpToken);
        setVerifiedPhone(json.data.phone || phone.trim());
        setOtpMessage({ type: 'ok', text: 'Mobile number verified successfully!' });
      }
    } catch {
      setOtpMessage({ type: 'err', text: 'Network error while verifying OTP.' });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!otpToken) {
      setFormError('Please verify your mobile number with OTP before submitting.');
      return;
    }
    if (!title.trim() || !producerName.trim() || !productionName.trim() || !emailIds.trim()) {
      setFormError('Please fill in all required title, producer, production house, and email fields.');
      return;
    }
    if (!isValidUrl(posterUrl) || !isValidUrl(googleDriveLink)) {
      setFormError('Please provide valid Google Drive URLs (starting with https://) for the Portrait Poster and Full Movie.');
      return;
    }
    if (bannerUrl.trim() && !isValidUrl(bannerUrl)) {
      setFormError('Landscape Banner link must be a valid URL starting with https://.');
      return;
    }
    if (trailerUrl.trim() && !isValidUrl(trailerUrl)) {
      setFormError('Trailer link must be a valid URL starting with https://.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBase()}/producer/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpToken,
          contentType,
          title: title.trim(),
          language,
          oneLineBrief: oneLineBrief.trim(),
          producerName: producerName.trim(),
          productionName: productionName.trim(),
          contactPhone: verifiedPhone || phone.trim(),
          emailIds: emailIds.trim(),
          posterUrl: posterUrl.trim(),
          bannerUrl: bannerUrl.trim() || undefined,
          trailerUrl: trailerUrl.trim() || undefined,
          googleDriveLink: googleDriveLink.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setFormError(json?.message || 'Submission failed. Please review your details and try again.');
      } else {
        const kycTok = json.data?.kycToken || '';
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://maxxpixels.com';
        setSubmittedResult({
          id: json.data?.id,
          kycToken: kycTok,
          trackingUrl: kycTok ? `${origin}/producer/content/collect?token=${kycTok}` : '',
        });
      }
    } catch {
      setFormError('Network error while submitting content. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError('');
    setKycSuccess('');

    if (!agreementAccepted) {
      setKycError('You must accept the Content Licensing Agreement to proceed.');
      return;
    }
    if (!agreementSignedName.trim()) {
      setKycError('Please enter your full legal signature name.');
      return;
    }
    if (!aadhaarNumber.trim() || !isValidUrl(aadhaarDocLink)) {
      setKycError('Please enter your Aadhaar number and a valid Google Drive link for the Aadhaar document.');
      return;
    }
    if (!panNumber.trim() || !isValidUrl(panDocLink)) {
      setKycError('Please enter your PAN number and a valid Google Drive link for the PAN card.');
      return;
    }
    if (
      !bankAccountHolder.trim() ||
      !bankAccountNumber.trim() ||
      !bankIfscCode.trim() ||
      !bankName.trim()
    ) {
      setKycError('Please complete all required bank account payout details.');
      return;
    }
    if (bankChequeLink.trim() && !isValidUrl(bankChequeLink)) {
      setKycError('Cancelled cheque link must be a valid URL starting with https://.');
      return;
    }

    setKycSubmitting(true);
    try {
      const res = await fetch(
        `${getApiBase()}/producer/collect/kyc/${encodeURIComponent(tokenParam)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agreementAccepted: true,
            agreementSignedName: agreementSignedName.trim(),
            aadhaarNumber: aadhaarNumber.trim(),
            aadhaarDocLink: aadhaarDocLink.trim(),
            panNumber: panNumber.trim().toUpperCase(),
            panDocLink: panDocLink.trim(),
            bankAccountHolder: bankAccountHolder.trim(),
            bankAccountNumber: bankAccountNumber.trim(),
            bankIfscCode: bankIfscCode.trim().toUpperCase(),
            bankName: bankName.trim(),
            bankChequeLink: bankChequeLink.trim() || undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setKycError(json?.message || 'Failed to submit Agreement & KYC details.');
      } else {
        setKycSuccess('Agreement & KYC submitted successfully! Our team has been notified for final verification.');
        await loadTokenStatus(tokenParam);
      }
    } catch {
      setKycError('Network error while submitting Agreement & KYC.');
    } finally {
      setKycSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-white py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Clean Brand Header — No Producer Portal links */}
        <header className="text-center space-y-2 pb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/15 border border-red-500/30 text-red-400 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            MaxxPixels Content Collection
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {tokenParam ? 'Content Submission Status & KYC' : 'Submit Your Content to MaxxPixels'}
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            {tokenParam
              ? 'Track your content verification status and complete your Licensing Agreement & KYC documents.'
              : 'Verify your mobile number, share Google Drive links for your poster, trailer, and full film, and our content team will review your submission.'}
          </p>
        </header>

        {/* MODE 2: STATUS & AGREEMENT/KYC VIEW (?token=...) */}
        {tokenParam ? (
          <div className="space-y-6">
            {statusLoading && (
              <div className="rounded-2xl border border-white/10 bg-[#111118] p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <p className="text-sm text-zinc-400">Loading your submission details...</p>
              </div>
            )}

            {!statusLoading && statusError && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-red-200">Unable to Load Submission</h2>
                  <p className="text-sm text-red-200/80 mt-1">{statusError}</p>
                </div>
              </div>
            )}

            {!statusLoading && submission && (
              <>
                <StatusStepper status={submission.status} />

                {/* Submission Summary Card */}
                <div className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        Submission #{submission.id} · {submission.contentType}
                      </span>
                      <h2 className="text-xl font-bold text-white mt-0.5">{submission.title}</h2>
                      {submission.productionName && (
                        <p className="text-sm text-zinc-400 mt-0.5">
                          {submission.producerName} · {submission.productionName}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        submission.status === 'ONBOARDED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : submission.status === 'KYC_PENDING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : submission.status === 'KYC_SUBMITTED'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : submission.status === 'REJECTED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-white/10 text-zinc-200 border border-white/15'
                      }`}
                    >
                      {submission.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {submission.oneLineBrief && (
                    <p className="text-sm text-zinc-300 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                      {submission.oneLineBrief}
                    </p>
                  )}

                  {/* Status-specific callout */}
                  {submission.status === 'SUBMITTED' && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-3">
                      <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-100">
                        <p className="font-semibold">Pending Admin Verification</p>
                        <p className="text-blue-200/80 mt-0.5">
                          Our team is verifying your content details and Google Drive assets. Once approved, this link will unlock the Licensing Agreement &amp; KYC step.
                        </p>
                      </div>
                    </div>
                  )}

                  {submission.status === 'KYC_SUBMITTED' && (
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-cyan-100">
                        <p className="font-semibold">Agreement &amp; KYC Submitted — Final Review In Progress</p>
                        <p className="text-cyan-200/80 mt-0.5">
                          Thank you! Our team is verifying your Aadhaar, PAN, and Bank details. Once cleared, your title will be onboarded directly into our catalog pipeline.
                        </p>
                      </div>
                    </div>
                  )}

                  {submission.status === 'ONBOARDED' && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-emerald-100">
                        <p className="font-semibold">Content Onboarded Successfully!</p>
                        <p className="text-emerald-200/80 mt-0.5">
                          Your content has been verified and onboarded to MaxxPixels as a Draft, and your assets are being transferred from Google Drive to our streaming CDN.
                        </p>
                      </div>
                    </div>
                  )}

                  {submission.status === 'REJECTED' && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-red-100">
                        <p className="font-semibold">Submission Not Approved</p>
                        <p className="text-red-200/80 mt-0.5">
                          {submission.reviewNotes || 'Please contact our content team for further details.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* AGREEMENT & KYC FORM — Shown when status === 'KYC_PENDING' */}
                {submission.status === 'KYC_PENDING' && (
                  <form onSubmit={handleSubmitKyc} className="space-y-6">
                    <CopyEmailBanner />

                    {/* Part A: Content Licensing Agreement */}
                    <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-red-500" />
                        <h3 className="text-lg font-bold">1. Content Licensing Agreement</h3>
                      </div>

                      <div className="h-48 overflow-y-auto rounded-xl bg-black/40 border border-white/10 p-4 text-xs text-zinc-300 leading-relaxed space-y-2.5">
                        <p className="font-semibold text-white">
                          MAXXPIXELS DIGITAL CONTENT DISTRIBUTION &amp; LICENSING AGREEMENT
                        </p>
                        <p>
                          This Agreement is entered into between the Rights Holder / Producer (&ldquo;Licensor&rdquo;) and MaxxPixels Media (&ldquo;Platform&rdquo;) for the digital exhibition and streaming of <strong>{submission.title}</strong> ({submission.contentType}).
                        </p>
                        <p>
                          <strong>1. Rights &amp; Warranty:</strong> Licensor warrants that they are the sole and lawful owner or authorized licensee of all intellectual property, music, visuals, and distribution rights in the submitted content and that it does not infringe any third-party rights.
                        </p>
                        <p>
                          <strong>2. Asset Ingestion:</strong> Licensor authorizes MaxxPixels to download the submitted master video, trailer, posters, and artwork from the provided Google Drive links and transcode/host them on MaxxPixels&apos; secure CDN for OTT playback.
                        </p>
                        <p>
                          <strong>3. Revenue &amp; Payouts:</strong> Eligible payouts shall be settled to the verified bank account provided in the KYC section below, subject to applicable Indian statutory taxes (TDS/GST) and platform settlement cycles.
                        </p>
                        <p>
                          <strong>4. Compliance:</strong> Submitted content must comply with applicable IT Rules and content guidelines. MaxxPixels reserves the right to hold or remove content if rights disputes or compliance issues arise.
                        </p>
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreementAccepted}
                          onChange={(e) => setAgreementAccepted(e.target.checked)}
                          className="mt-1 w-4 h-4 accent-red-600 rounded"
                        />
                        <span className="text-sm text-zinc-200">
                          I confirm that I hold full rights to <strong>{submission.title}</strong> and I accept the MaxxPixels Content Licensing Agreement.
                        </span>
                      </label>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                          Full Legal Signature Name *
                        </label>
                        <input
                          type="text"
                          value={agreementSignedName}
                          onChange={(e) => setAgreementSignedName(e.target.value)}
                          placeholder="Enter your full legal name as digital signature"
                          className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                          required
                        />
                      </div>
                    </section>

                    {/* Part B: Identity KYC (Aadhaar & PAN) */}
                    <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-red-500" />
                        <h3 className="text-lg font-bold">2. Identity KYC Documents (Aadhaar &amp; PAN)</h3>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Provide Google Drive links to clear scans/photos of your Aadhaar &amp; PAN shared with{' '}
                        <span className="text-amber-300 font-mono">{DRIVE_SHARE_EMAIL}</span>.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Aadhaar Number *
                          </label>
                          <input
                            type="text"
                            value={aadhaarNumber}
                            onChange={(e) => setAadhaarNumber(e.target.value)}
                            placeholder="XXXX XXXX XXXX"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Aadhaar Google Drive Link *
                          </label>
                          <input
                            type="url"
                            value={aadhaarDocLink}
                            onChange={(e) => setAadhaarDocLink(e.target.value)}
                            placeholder="https://drive.google.com/file/d/..."
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            PAN Number *
                          </label>
                          <input
                            type="text"
                            value={panNumber}
                            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white uppercase placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            PAN Card Google Drive Link *
                          </label>
                          <input
                            type="url"
                            value={panDocLink}
                            onChange={(e) => setPanDocLink(e.target.value)}
                            placeholder="https://drive.google.com/file/d/..."
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                      </div>
                    </section>

                    {/* Part C: Bank Account Details */}
                    <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <Landmark className="w-5 h-5 text-red-500" />
                        <h3 className="text-lg font-bold">3. Bank Account Details (For Payouts)</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Account Holder Name *
                          </label>
                          <input
                            type="text"
                            value={bankAccountHolder}
                            onChange={(e) => setBankAccountHolder(e.target.value)}
                            placeholder="Name as per bank records"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Bank Name *
                          </label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. HDFC Bank, SBI, ICICI"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Bank Account Number *
                          </label>
                          <input
                            type="text"
                            value={bankAccountNumber}
                            onChange={(e) => setBankAccountNumber(e.target.value)}
                            placeholder="Enter account number"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            IFSC Code *
                          </label>
                          <input
                            type="text"
                            value={bankIfscCode}
                            onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                            placeholder="e.g. HDFC0001234"
                            className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white uppercase placeholder-zinc-500 focus:outline-none focus:border-red-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                          Cancelled Cheque / Passbook Google Drive Link (Optional)
                        </label>
                        <input
                          type="url"
                          value={bankChequeLink}
                          onChange={(e) => setBankChequeLink(e.target.value)}
                          placeholder="https://drive.google.com/file/d/..."
                          className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </section>

                    {kycError && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {kycError}
                      </div>
                    )}
                    {kycSuccess && (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-sm text-emerald-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        {kycSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={kycSubmitting}
                      className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {kycSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting Agreement &amp; KYC...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Sign Agreement &amp; Submit KYC Documents
                        </>
                      )}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        ) : submittedResult ? (
          /* MODE 1 SUCCESS CONFIRMATION */
          <div className="rounded-2xl border border-emerald-500/30 bg-[#111118] p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-white">Submission Received!</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Your submission <strong className="text-white">#{submittedResult.id}</strong> has been sent to our review team. Once your content details and Google Drive access are verified, we will unlock your Agreement &amp; KYC step.
              </p>
            </div>

            {submittedResult.trackingUrl && (
              <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Your Status &amp; KYC Tracking Link (Save this link)
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <code className="flex-1 text-xs text-cyan-300 bg-white/[0.04] px-3 py-2 rounded-lg break-all">
                    {submittedResult.trackingUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(submittedResult.trackingUrl);
                      setCopiedTracking(true);
                      setTimeout(() => setCopiedTracking(false), 2000);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition cursor-pointer shrink-0"
                  >
                    {copiedTracking ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedTracking ? 'Copied' : 'Copy Link'}
                  </button>
                  <a
                    href={submittedResult.trackingUrl}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition shrink-0"
                  >
                    Open Status <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* MODE 1: NEW CONTENT COLLECTION FORM */
          <form onSubmit={handleSubmitContent} className="space-y-6">
            <CopyEmailBanner />

            {/* STEP 1: MOBILE NUMBER OTP VERIFICATION */}
            <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-5 h-5 text-red-500" />
                  <h2 className="text-base sm:text-lg font-bold">1. Mobile Number Verification (OTP)</h2>
                </div>
                {otpToken && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={Boolean(otpToken)}
                    placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 disabled:opacity-60 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
                {!otpToken && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || resendCooldown > 0}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {otpLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : otpSent
                      ? 'Resend OTP'
                      : 'Send OTP'}
                  </button>
                )}
              </div>

              {otpSent && !otpToken && (
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="flex-1 rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white tracking-widest font-mono placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpVerifying}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    {otpVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                    Verify OTP
                  </button>
                </div>
              )}

              {otpMessage && (
                <p
                  className={`text-xs font-medium ${
                    otpMessage.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {otpMessage.text}
                </p>
              )}
            </section>

            {/* STEP 2: CONTENT & PRODUCER DETAILS */}
            <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Film className="w-5 h-5 text-red-500" />
                <h2 className="text-base sm:text-lg font-bold">2. Content &amp; Contact Details</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Content Type *
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    {contentTypes.map((ct) => (
                      <option key={ct.code} value={ct.code} className="bg-[#111118]">
                        {ct.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Language *
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.name} className="bg-[#111118]">
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Content Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter movie / series / short film title"
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    One-Line Brief / Synopsis *
                  </label>
                  <textarea
                    rows={3}
                    value={oneLineBrief}
                    onChange={(e) => setOneLineBrief(e.target.value)}
                    placeholder="Short synopsis, genre, cast highlights, runtime..."
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Producer / Contact Name *
                  </label>
                  <input
                    type="text"
                    value={producerName}
                    onChange={(e) => setProducerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Production House / Banner *
                  </label>
                  <input
                    type="text"
                    value={productionName}
                    onChange={(e) => setProductionName(e.target.value)}
                    placeholder="Studio or production banner name"
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Email ID(s) *
                  </label>
                  <input
                    type="text"
                    value={emailIds}
                    onChange={(e) => setEmailIds(e.target.value)}
                    placeholder="producer@studio.com (comma-separated for multiple)"
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>
            </section>

            {/* STEP 3: GOOGLE DRIVE ASSET LINKS (NO FILE UPLOADS) */}
            <section className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Link2 className="w-5 h-5 text-red-500" />
                <h2 className="text-base sm:text-lg font-bold">3. Google Drive Asset Links</h2>
              </div>
              <p className="text-xs text-zinc-400">
                Paste shareable Google Drive links for each asset and ensure access is granted to{' '}
                <span className="text-amber-300 font-mono">{DRIVE_SHARE_EMAIL}</span>.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Portrait Poster (3:4) Google Drive Link *
                  </label>
                  <input
                    type="url"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Landscape Banner (16:9) Google Drive Link
                  </label>
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Trailer Google Drive Link
                  </label>
                  <input
                    type="url"
                    value={trailerUrl}
                    onChange={(e) => setTrailerUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Full Movie / Master Video Google Drive Link *
                  </label>
                  <input
                    type="url"
                    value={googleDriveLink}
                    onChange={(e) => setGoogleDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>
            </section>

            {formError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-sm text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                disabled={submitting || !otpToken}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting for Admin Review...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Submit Content for Review
                  </>
                )}
              </button>
              {!otpToken && (
                <p className="text-center text-xs text-amber-400/90">
                  Complete Step 1 (Mobile OTP Verification) to enable submission.
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ProducerContentCollectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08080c] text-white flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
        </div>
      }
    >
      <CollectContentInner />
    </Suspense>
  );
}
