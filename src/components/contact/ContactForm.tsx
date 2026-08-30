"use client";

// "use client": five controlled fields, a submit that POSTs, and the success
// and error states that follow it.

import { useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";

import { contactAPI } from "@/lib/api/contact";
import { ApiError } from "@/lib/api/errors";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/** The `{ error }` envelope `POST /api/contact` returns on a 4xx. */
interface ContactErrorBody {
  error?: string;
}

interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot. Blank for a human; the API rejects any submission that fills it. */
  website: string;
}

const EMPTY_FORM: ContactFormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

/** How long the "Message Sent!" panel stays up before the form returns. */
const SUCCESS_RESET_MS = 3000;

/**
 * The contact form.
 *
 * Validation is the browser's, exactly as before: `required` on the four visible
 * fields and `type="email"` on the address, with no JavaScript checks of its
 * own — the server re-validates and owns the error text.
 *
 * The CSRF handshake is not visible here on purpose. `contactAPI.sendMessage`
 * goes through the ported api client, which attaches the token, and on a 403
 * mints a fresh one and replays the request once. The user-facing wording for a
 * CSRF failure is substituted into `response.data.error` by that same client, so
 * reading that field — as the source did — is what surfaces it.
 */
export function ContactForm() {
  const [formData, setFormData] = useState<ContactFormState>(EMPTY_FORM);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { ref: formRef, isVisible: formVisible } = useScrollReveal({ threshold: 0.15 });

  // The success panel clears itself on a timer. Held in a ref so navigating away
  // mid-countdown cancels it instead of leaving it to fire into a dead tree.
  const resetTimerRef = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await contactAPI.sendMessage({
        name: formData.name,
        email: formData.email,
        phone: "",
        subject: formData.subject,
        message: formData.message,
        website: formData.website,
      });

      setIsSubmitted(true);
      resetTimerRef.current = window.setTimeout(() => {
        setIsSubmitted(false);
        setFormData(EMPTY_FORM);
      }, SUCCESS_RESET_MS);
    } catch (error) {
      // `error?.response?.data?.error` in the source; narrowed here because the
      // ported client throws a typed ApiError rather than an axios error.
      const serverMessage =
        error instanceof ApiError
          ? (error.response?.data as ContactErrorBody | undefined)?.error
          : undefined;
      setSubmitError(serverMessage || "Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`md:col-span-2 reveal reveal-right ${
        formVisible ? "active" : ""
      }`}
      ref={formRef}
    >
      <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-5 sm:p-6 md:p-6 lg:p-7 border border-gray-100">
        <h2 className="font-display text-lg font-bold text-[#2d3a2d] mb-5">
          Send us a Message
        </h2>

        {isSubmitted ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#2d3a2d] mb-2">
              Message Sent!
            </h3>
            <p className="text-[#6b7a6b] text-sm">
              Thank you for reaching out. We will get back to you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-[#2d3a2d] mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 text-sm"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#2d3a2d] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 text-sm"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2d3a2d] mb-1.5">
                Subject
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 text-sm"
                placeholder="How can we help?"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#2d3a2d] mb-1.5">
                Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                rows={5}
                className="w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 resize-none text-sm"
                placeholder="Tell us more about your inquiry..."
                required
              />
            </div>

            {/* Honeypot: hidden from humans, traps bots */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#3d7a3d] px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#2f642f] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#3d7a3d]/30 min-h-[44px]"
            >
              {isSubmitting ? "Sending..." : "Send Message"}
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
