import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Check,
  ExternalLink,
} from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { contactAPI } from "@/services/api";

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const { ref, isVisible } = useScrollReveal();

  const mapEmbedUrl =
    "https://www.openstreetmap.org/export/embed.html?bbox=74.280%2C31.500%2C74.390%2C31.620&layer=mapnik&marker=31.560%2C74.340";
  const directionsUrl =
    "https://www.google.com/maps/search/?api=1&query=Pakistan%2C+Lahore";

  const handleSubmit = async (e) => {
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
      });

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ name: "", email: "", subject: "", message: "" });
      }, 3000);
    } catch (error) {
      setSubmitError(
        error?.response?.data?.error ||
          "Failed to send message. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email",
      content: "support@naturanzafoods.com",
      link: "mailto:support@naturanzafoods.com",
    },
    {
      icon: Phone,
      title: "Phone",
      content: "+92 347 4147400",
      link: "tel:+923474147400",
    },
    {
      icon: MapPin,
      title: "Address",
      content: "Pakistan",
      link: null,
    },
    {
      icon: Clock,
      title: "Hours",
      content: "Available 24/7",
      link: null,
    },
  ];

  return (
    <main className="pt-20 sm:pt-24 pb-14 sm:pb-16 bg-[#faf8f3] min-h-screen overflow-x-hidden">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12" ref={ref}>
          <span className="text-[#3d7a3d] font-medium text-[11px] uppercase tracking-wider">
            Get in Touch
          </span>
          <h1
            className={`font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mt-2 mb-3 ${
              isVisible ? "" : "opacity-0"
            }`}
          >
            Contact Us
          </h1>
          <p
            className={`text-[#6b7a6b] max-w-2xl mx-auto text-sm ${
              isVisible ? "" : "opacity-0"
            }`}
            style={{ animationDelay: "0.2s" }}
          >
            Have a question or feedback? We would love to hear from you. Reach
            out to us and we will get back to you as soon as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6 lg:gap-7 items-start">
          {/* Contact Info */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-5 sm:p-6 border border-gray-100 md:sticky md:top-28">
              <h2 className="font-display text-lg font-bold text-[#2d3a2d] mb-5">
                Contact Information
              </h2>
              <div className="space-y-5">
                {contactInfo.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-[#3d7a3d]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-4 h-4 text-[#3d7a3d]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#2d3a2d] text-sm">
                        {item.title}
                      </h3>
                      {item.link ? (
                        <a
                          href={item.link}
                          className="text-[#6b7a6b] hover:text-[#3d7a3d] text-sm"
                        >
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-[#6b7a6b] text-sm">{item.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Social Links */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium text-[#2d3a2d] mb-3 text-sm">
                  Follow Us
                </h3>
                <div className="flex gap-2.5">
                  {["Facebook", "Instagram", "Twitter", "Youtube"].map(
                    (social) => (
                      <a
                        key={social}
                        href={`https://${social.toLowerCase()}.com`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social}
                        className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-[#3d7a3d] hover:text-white"
                      >
                        <span className="text-xs font-bold">{social[0]}</span>
                      </a>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-[#dbe8db] bg-[#f4faf4] p-4">
                <p className="text-[13px] text-[#2d3a2d] font-semibold mb-1">
                  Fast Response
                </p>
                <p className="text-xs text-[#5f705f] leading-relaxed">
                  Our support team usually replies within 24 hours on business
                  days.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
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
        </div>

        {/* Map */}
        <div className="mt-10 sm:mt-12 lg:mt-14">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display text-base md:text-lg font-bold text-[#2d3a2d]">
                  Visit Our Store
                </h3>
                <p className="text-sm text-[#6b7a6b]">Pakistan, Lahore</p>
              </div>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3d7a3d] hover:text-[#2f642f]"
              >
                Open in Google Maps
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="relative h-[260px] sm:h-[320px] md:h-[360px]">
              {!mapLoaded && (
                <div
                  className="absolute inset-0 bg-[#f3f4f2]"
                  aria-hidden="true"
                />
              )}
              <iframe
                src={mapEmbedUrl}
                width="100%"
                height="100%"
                onLoad={() => setMapLoaded(true)}
                style={{ border: 0 }}
                allowFullScreen
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                title="Naturanza Location"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
