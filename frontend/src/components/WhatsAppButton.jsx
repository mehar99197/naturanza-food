import { useSettings } from "@/context/SettingsContext";

const normalizeWhatsAppNumber = (value) =>
  String(value || "").replace(/[^\d]/g, "");

const WhatsAppButton = () => {
  const { settings } = useSettings();

  if (settings?.whatsappEnabled === false) {
    return null;
  }

  const number = normalizeWhatsAppNumber(settings?.whatsappNumber);
  if (!number) {
    return null;
  }

  const link = `https://wa.me/${number}`;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-50">
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-12 w-12 items-center justify-center rounded-full animate-whatsapp-glow"
        style={{
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
        }}
        aria-label="Contact on WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6 text-white"
          aria-hidden="true"
        >
          <path d="M20.52 3.48A11.82 11.82 0 0 0 12 0C5.37 0 .03 5.34.03 11.96c0 2.11.55 4.18 1.6 6L0 24l6.2-1.6a11.88 11.88 0 0 0 5.78 1.48h.02c6.62 0 11.97-5.34 11.97-11.96 0-3.2-1.25-6.21-3.45-8.44ZM12 21.9h-.02a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.68.95.98-3.59-.24-.37a9.89 9.89 0 0 1-1.52-5.34c.01-5.46 4.47-9.91 9.95-9.91a9.9 9.9 0 0 1 9.95 9.91c0 5.46-4.46 9.94-9.93 9.94Zm5.45-7.45c-.3-.15-1.76-.86-2.03-.96-.27-.1-.46-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.51h-.56c-.2 0-.52.08-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35Z" />
        </svg>
      </a>
    </div>
  );
};

export default WhatsAppButton;
