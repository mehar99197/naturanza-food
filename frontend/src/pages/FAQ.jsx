import { HelpCircle } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';

const faqs = [
 {
 question: 'How long does delivery take?',
 answer: 'Most orders are delivered within 2 to 5 business days, depending on your location.',
 },
 {
 question: 'Are your products 100% organic?',
 answer: 'Yes, we source from trusted farms and prioritize certified organic and natural ingredients.',
 },
 {
 question: 'Can I track my order?',
 answer: 'Yes, you can track your order from your account order section after dispatch.',
 },
 {
 question: 'Do you offer refunds?',
 answer: 'Yes, eligible products can be returned under our returns policy if conditions are met.',
 },
 {
 question: 'How can I contact support quickly?',
 answer: `You can reach us at ${BUSINESS_INFO.contacts.supportEmail} or call ${BUSINESS_INFO.contacts.phone} during ${BUSINESS_INFO.supportHours}.`,
 },
 {
 question: 'Do you deliver outside Pakistan?',
 answer: 'At the moment, we primarily serve Pakistan. International shipping availability may vary by product and destination.',
 },
 {
 question: 'How do I change or cancel an order?',
 answer: 'Order changes or cancellations are possible before dispatch. Contact support immediately with your order ID for assistance.',
 },
];

export function FAQ() {
 return (
 <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <HelpCircle className="w-4 h-4" />
 Support
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Frequently Asked Questions</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Quick answers to common questions about orders, products, and support.
 </p>
 </header>

 <section className="max-w-4xl mx-auto grid gap-4">
 {faqs.map((item) => (
 <article key={item.question} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
 <h2 className="text-base md:text-lg font-semibold text-[#2d3a2d] mb-2">{item.question}</h2>
 <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">{item.answer}</p>
 </article>
 ))}
 </section>

 <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6">
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Need more help? Contact our support desk at {BUSINESS_INFO.contacts.supportEmail} or {BUSINESS_INFO.contacts.phone}.
 </p>
 </section>
 </div>
 </main>
 );
}

export default FAQ;
