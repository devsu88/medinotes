"use client"

import { useState, FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Link from 'next/link';
import { Protect, PricingTable, UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

function ConsultationForm() {
    const { getToken } = useAuth();

    // Form state
    const [patientName, setPatientName] = useState('');
    const [visitDate, setVisitDate] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');
    const [specialty, setSpecialty] = useState('General Practice');
    const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine');

    // Streaming state
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    // Action feedback state
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [copiedAll, setCopiedAll] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setOutput('');
        setLoading(true);

        const jwt = await getToken();
        if (!jwt) {
            setOutput('Authentication required');
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let buffer = '';

        await fetchEventSource('/api/consultation', {
            signal: controller.signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                patient_name: patientName,
                date_of_visit: visitDate?.toISOString().slice(0, 10),
                notes,
                specialty,
                urgency,
            }),
            onmessage(ev) {
                buffer += ev.data;
                setOutput(buffer);
            },
            onclose() {
                setLoading(false);
            },
            onerror(err) {
                console.error('SSE error:', err);
                controller.abort();
                setLoading(false);
            },
        });
    }

    const handleCopyEmail = () => {
        if (!output) return;
        const emailMarker = "### Draft of email to patient";
        const idx = output.indexOf(emailMarker);
        let textToCopy = output;
        if (idx !== -1) {
            textToCopy = output.substring(idx).replace(/^#+\s*Draft of email to patient.*$/m, '').trim();
        }
        navigator.clipboard.writeText(textToCopy);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    const handleCopyAll = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const handleExportText = () => {
        if (!output) return;
        const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medinotes_${patientName ? patientName.toLowerCase().replace(/\s+/g, '_') : 'consultation'}_${visitDate?.toISOString().slice(0, 10) || 'report'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const specialtiesList = [
        "General Practice",
        "cardiology",
        "pediatrics",
        "psychiatry",
        "dermatology",
        "orthopedics"
    ];

    const formatSpecialtyLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8 print:hidden">
                Consultation Notes
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 print:hidden border border-gray-100 dark:border-gray-700 transition-all duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="patient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Patient Name
                        </label>
                        <input
                            id="patient"
                            type="text"
                            required
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                            placeholder="Enter patient's full name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Date of Visit
                        </label>
                        <DatePicker
                            id="date"
                            selected={visitDate}
                            onChange={(d: Date | null) => setVisitDate(d)}
                            dateFormat="yyyy-MM-dd"
                            placeholderText="Select date"
                            required
                            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Medical Specialty
                    </label>
                    <select
                        id="specialty"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all capitalize"
                    >
                        {specialtiesList.map((spec) => (
                            <option key={spec} value={spec} className="capitalize">
                                {formatSpecialtyLabel(spec)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Urgency Level
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setUrgency('routine')}
                            className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all flex items-center justify-center gap-2 ${
                                urgency === 'routine'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                            Routine
                        </button>
                        <button
                            type="button"
                            onClick={() => setUrgency('urgent')}
                            className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all flex items-center justify-center gap-2 ${
                                urgency === 'urgent'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-600 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                            Urgent
                        </button>
                        <button
                            type="button"
                            onClick={() => setUrgency('emergency')}
                            className={`py-2 px-4 rounded-lg font-medium text-sm border transition-all flex items-center justify-center gap-2 ${
                                urgency === 'emergency'
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-600 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block animate-pulse"></span>
                            Emergency
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Consultation Notes
                    </label>
                    <textarea
                        id="notes"
                        required
                        rows={8}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all leading-relaxed font-sans"
                        placeholder="Enter detailed consultation notes, physical findings, patient complaints..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white font-semibold py-3.5 px-6 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] duration-150"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating Customized Summary...
                        </span>
                    ) : (
                        'Generate Medical Summary'
                    )}
                </button>
            </form>

            {output && (
                <section className="mt-10 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-200 dark:border-gray-700 print:shadow-none print:border-0 print:p-0 print:mt-0">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200 dark:border-gray-700 print:hidden">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">📑</span>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                Generated Record & Actions
                            </h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleCopyEmail}
                                className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all shadow-sm"
                                title="Copy only the patient email section"
                            >
                                {copiedEmail ? '✓ Email Copied!' : '✉️ Copy Email'}
                            </button>
                            <button
                                onClick={handleCopyAll}
                                className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all shadow-sm"
                                title="Copy all markdown output"
                            >
                                {copiedAll ? '✓ All Copied!' : '📋 Copy All'}
                            </button>
                            <button
                                onClick={handleExportText}
                                className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-sm"
                                title="Download as .md file"
                            >
                                💾 Download MD
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-sm"
                                title="Print report or save as PDF"
                            >
                                🖨️ Print / PDF
                            </button>
                        </div>
                    </div>

                    <div className="print:block hidden mb-6 pb-4 border-b border-gray-300">
                        <h1 className="text-2xl font-bold text-black mb-1">Medical Consultation Report</h1>
                        <div className="text-sm text-gray-700 flex gap-6 mt-2">
                            <span><strong>Patient:</strong> {patientName || 'N/A'}</span>
                            <span><strong>Date:</strong> {visitDate?.toISOString().slice(0, 10)}</span>
                            <span><strong>Specialty:</strong> {formatSpecialtyLabel(specialty)}</span>
                            <span><strong>Urgency:</strong> {urgency.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="markdown-content prose prose-blue dark:prose-invert max-w-none print:prose-neutral print:max-w-full print:text-black leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {output}
                        </ReactMarkdown>
                    </div>
                </section>
            )}
        </div>
    );
}

export default function Product() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <SignedOut>
                <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
                    <div className="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full transition-all">
                        <div className="text-5xl mb-6">🔒</div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                            Access Restricted
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed text-sm">
                            You need to be signed in to access the MediNotes Pro Consultation Assistant and view patient records.
                        </p>
                        <div className="space-y-4">
                            <SignInButton mode="modal">
                                <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.99]">
                                    Sign In to Continue
                                </button>
                            </SignInButton>
                            <div>
                                <Link href="/" className="inline-block text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mt-2">
                                    ← Back to Home
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </SignedOut>

            <SignedIn>
                {/* User Menu in Top Right */}
                <div className="absolute top-4 right-4 print:hidden">
                    <UserButton showName={true} />
                </div>

                {/* Subscription Protection */}
                <Protect
                    plan="premium_subscription"
                    fallback={
                        <div className="container mx-auto px-4 py-12">
                            <header className="text-center mb-12">
                                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                                    Healthcare Professional Plan
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                                    Streamline your patient consultations with AI-powered summaries
                                </p>
                            </header>
                            <div className="max-w-4xl mx-auto">
                                <PricingTable />
                            </div>
                        </div>
                    }
                >
                    <ConsultationForm />
                </Protect>
            </SignedIn>
        </main>
    );
}