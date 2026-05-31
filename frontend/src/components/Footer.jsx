import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, Youtube, ArrowRight, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { categoryAPI, newsletterAPI } from '@/services/api';
import { useSettings } from '@/context/SettingsContext';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Footer({ variant = 'full' }) {
 const { settings } = useSettings();
 const [email, setEmail] = useState('');
 const [isSubscribed, setIsSubscribed] = useState(false);
 const [subscribeMessage, setSubscribeMessage] = useState('');
 const [subscribeError, setSubscribeError] = useState('');
 const [isSubscribing, setIsSubscribing] = useState(false);
 const [openSection, setOpenSection] = useState(null);
 const [categories, setCategories] = useState([]);

 const supportEmail = settings.storeEmail || 'support@naturanzafood.com';
 const supportPhone = settings.storePhone || '+92340 9502646';
 const phoneLink = normalizePhoneLink(supportPhone);
 
 // Slim version - compact footer for non-home pages
 const isSlim = variant === 'slim';

 // Fetch active categories from the database
 useEffect(() => {
  const fetchCategories = async () => {
   try {
    const response = await categoryAPI.getAll();
    // Filter only active categories
    const activeCategories = (response?.categories || response || [])
     .filter(cat => cat.is_active === 1 || cat.is_active === true)
     .map(cat => ({
      label: cat.name,
      path: `/shop?category=${cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')}`
     }));
    setCategories(activeCategories);
   } catch (error) {
    console.error('Failed to fetch categories:', error);
    // Fallback to empty array if fetch fails
    setCategories([]);
   }
  };

  fetchCategories();
  
  // Refresh categories every 30 seconds to sync with admin changes
  const intervalId = setInterval(fetchCategories, 30000);
  
  return () => clearInterval(intervalId);
 }, []);

 const handleSubscribe = async (e) => {
 e.preventDefault();
 const trimmedEmail = email.trim();
 if (!trimmedEmail || isSubscribing) {
 return;
 }
 setIsSubscribing(true);
 setSubscribeError('');
 try {
 const response = await newsletterAPI.subscribe(trimmedEmail, 'footer');
 setIsSubscribed(true);
 setSubscribeMessage(response?.message || 'Thank you for subscribing!');
 setEmail('');
 setTimeout(() => {
 setIsSubscribed(false);
 setSubscribeMessage('');
 }, 5000);
 } catch (error) {
 const apiError = error?.response?.data?.error;
 setSubscribeError(apiError || 'Could not subscribe. Please try again.');
 setTimeout(() => setSubscribeError(''), 5000);
 } finally {
 setIsSubscribing(false);
 }
 };

 const toggleSection = (section) => {
 setOpenSection(openSection === section ? null : section);
 };

 const footerLinks = {
 shop: categories, // Dynamic categories from database
 company: [
 { label: 'About Us', path: '/about' },
 { label: 'Our Story', path: '/about' },
 { label: 'Contact', path: '/contact' }
 ],
 support: [
 { label: 'FAQs', path: '/faq' },
 { label: 'Shipping', path: '/shipping' },
 { label: 'Returns', path: '/returns' }
 // Privacy Policy lives in the bottom legal strip — kept single to avoid duplication
 ]
 };

 const socialLinks = [
 { label: 'Facebook', href: settings.facebookUrl, icon: Facebook },
 { label: 'Instagram', href: settings.instagramUrl, icon: Instagram },
 { label: 'Twitter', href: settings.twitterUrl, icon: Twitter },
 { label: 'YouTube', href: settings.youtubeUrl, icon: Youtube }
 ].filter((item) => item.href);

 const locationLabel = settings.mapLocationLabel || 'Pakistan, Lahore';

 // Slim Footer Version - Minimal design for non-home pages
 if (isSlim) {
 return (
 <footer className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 border-t border-white/10">
 {/* Subtle Background */}
 <div className="absolute inset-0 opacity-5">
 <div className="absolute inset-0" style={{
 backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
 backgroundSize: '64px 64px'
 }}></div>
 </div>
 
 {/* Minimal Decorative Element */}
 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-green-400/10 rounded-full blur-3xl"></div>
 
 <div className="container-custom py-8 relative z-10">
 {/* Compact Content */}
 <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
 {/* Logo & Tagline */}
 <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
 <Link to="/" className="flex items-center group">
 <div className="h-12 w-32 flex items-center justify-center">
 <img 
 src="/images/f_logo.png"
 alt="Naturanza Food" 
 className="h-full object-contain brightness-0 invert drop-shadow-lg md:group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
 />
 </div>
 </Link>
 <p className="text-white/80 text-sm font-medium text-center sm:text-left">
 Pure Nature. Pure Health.
 </p>
 </div>
 
 {/* Quick Links + Social (grouped on the right so the row stays balanced
 even when no social links are configured) */}
 <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 md:gap-8">
 <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
 <Link to="/about" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
 About
 </Link>
 <Link to="/shop" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
 Shop
 </Link>
 <Link to="/contact" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
 Contact
 </Link>
 <Link to="/faq" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
 FAQ
 </Link>
 </nav>

 {socialLinks.length > 0 && (
 <div className="flex gap-2.5">
 {socialLinks.map((social) => {
 const Icon = social.icon;
 return (
 <a
 key={social.label}
 href={social.href}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={social.label}
 className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg flex items-center justify-center md:hover:bg-white/20 transition-all duration-300"
 >
 <Icon className="w-4 h-4 text-white" />
 </a>
 );
 })}
 </div>
 )}
 </div>
 </div>
 
 {/* Copyright */}
 <div className="mt-6 pt-6 border-t border-white/10 text-center">
 <p className="text-white/70 text-xs md:text-sm font-medium">
 © 2026 Naturanza Food. All rights reserved.
 </p>
 </div>
 </div>
 </footer>
 );
 }
 
 // Full Footer Version - Complete design for home page
 return (
 <footer className="relative overflow-x-hidden bg-gradient-to-br from-green-900 via-green-800 to-emerald-900">
 {/* Modern Grid Pattern */}
 <div className="absolute inset-0 opacity-5">
 <div className="absolute inset-0" style={{
 backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
 backgroundSize: '64px 64px'
 }}></div>
 </div>
 
 {/* Decorative Elements - Enhanced */}
 <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-500/20 to-emerald-400/15 rounded-full blur-3xl"></div>
 <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/20 to-green-400/15 rounded-full blur-3xl"></div>
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-400/10 rounded-full blur-3xl"></div>
 
 {/* Newsletter Section */}
 <div className="border-b border-white/10 relative z-10">
 <div className="container-custom py-8 md:py-10 lg:py-12">
 <div className="relative rounded-3xl p-[1px] bg-gradient-to-r from-emerald-200/30 via-white/25 to-green-200/30 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
 <div className="rounded-3xl bg-white/[0.05] backdrop-blur-md px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
 <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 lg:gap-10">
 <div className="text-center md:text-left">
 <h3 className="font-display text-lg sm:text-xl md:text-2xl font-black mb-2 md:mb-3 bg-gradient-to-r from-white via-green-100 to-emerald-200 bg-clip-text text-transparent">Join the Naturanza Family</h3>
 <p className="text-white/90 text-xs md:text-sm font-medium">Get exclusive offers and wellness tips delivered to your inbox.</p>
 </div>
 <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row w-full md:w-auto md:min-w-[360px] gap-2 md:gap-3">
 <input
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="Enter your email"
 required
 disabled={isSubscribing}
 className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-64 md:w-72 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
 />
 <button
 type="submit"
 disabled={isSubscribing || !email.trim()}
 className="btn-3d px-4 md:px-5 py-1.5 md:py-2 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 md:hover:from-green-600 md:hover:to-emerald-700 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-2xl shadow-green-900/50 md:hover:shadow-green-900/70 active:scale-95 transition-all duration-300 md:hover:-translate-y-0.5 md:hover:ring-1 md:hover:ring-emerald-200/70 disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {isSubscribing ? 'Subscribing...' : 'Subscribe'}
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </form>
 </div>
 </div>
 </div>
 {isSubscribed && (
 <div className="mt-6 text-center">
 <div className="inline-flex items-center gap-2.5 glass-effect px-6 py-3 rounded-2xl border border-green-500/40 shadow-xl">
 <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
 <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 </div>
 <span className="text-green-300 font-bold text-sm">{subscribeMessage || 'Thank you for subscribing!'}</span>
 </div>
 </div>
 )}
 {subscribeError && (
 <div className="mt-6 text-center">
 <div className="inline-flex items-center gap-2.5 glass-effect px-6 py-3 rounded-2xl border border-red-500/40 shadow-xl">
 <span className="text-red-200 font-semibold text-sm">{subscribeError}</span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Main Footer */}
 <div className="container-custom py-6 sm:py-7 md:py-10 lg:py-12 relative z-10">
 {/* Mobile Accordion Layout */}
 <div className="md:hidden space-y-4 mb-3 sm:mb-4">
 {/* Brand Section - Always Visible */}
 <div className="text-center">
 <Link to="/" className="flex items-center gap-3 mb-4 group justify-center">
 <div className="h-14 w-36 flex items-center justify-center">
 <img 
 src="/images/f_logo.png"
 alt="Naturanza Food" 
 className="h-full object-contain brightness-0 invert drop-shadow-2xl"
 />
 </div>
 </Link>
 <p className="text-white/90 mb-5 max-w-sm text-sm leading-relaxed font-medium mx-auto px-4">
 Pure Nature. Pure Health. Discover our range of premium organic products.
 </p>
 <div className="flex gap-3 justify-center">
 {socialLinks.map((social) => {
 const Icon = social.icon;
 return (
 <a
 key={`mobile-${social.label}`}
 href={social.href}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={`Follow us on ${social.label}`}
 className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.2)] active:bg-white/20 active:scale-95 transition-all duration-300"
 >
 <Icon className="w-4 h-4 text-white" />
 </a>
 );
 })}
 </div>
 </div>

 {/* Shop Accordion */}
 <div className="border-t border-white/10">
 <button
 onClick={() => toggleSection('shop')}
 className="w-full flex items-center justify-between py-3.5 text-white font-bold text-sm"
 >
 Shop
 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openSection === 'shop' ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ${openSection === 'shop' ? 'max-h-64' : 'max-h-0'}`}>
 <ul className="space-y-3 pb-4">
 {footerLinks.shop.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 active:text-white text-sm font-medium inline-block transition-all duration-200 active:translate-x-1"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 </div>

 {/* Company Accordion */}
 <div className="border-t border-white/10">
 <button
 onClick={() => toggleSection('company')}
 className="w-full flex items-center justify-between py-3.5 text-white font-bold text-sm"
 >
 Company
 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openSection === 'company' ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ${openSection === 'company' ? 'max-h-56' : 'max-h-0'}`}>
 <ul className="space-y-3 pb-4">
 {footerLinks.company.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 active:text-white text-sm font-medium inline-block transition-all duration-200 active:translate-x-1"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 </div>

 {/* Support Accordion */}
 <div className="border-t border-white/10">
 <button
 onClick={() => toggleSection('support')}
 className="w-full flex items-center justify-between py-3.5 text-white font-bold text-sm"
 >
 Support
 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openSection === 'support' ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ${openSection === 'support' ? 'max-h-64' : 'max-h-0'}`}>
 <ul className="space-y-3 pb-4">
 {footerLinks.support.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 active:text-white text-sm font-medium inline-block transition-all duration-200 active:translate-x-1"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>
 </div>

 {/* Contact Accordion */}
 <div className="border-t border-white/10">
 <button
 onClick={() => toggleSection('contact')}
 className="w-full flex items-center justify-between py-3.5 text-white font-bold text-sm"
 >
 Contact
 <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openSection === 'contact' ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ${openSection === 'contact' ? 'max-h-80' : 'max-h-0'}`}>
 <ul className="space-y-4 pb-4">
 <li>
 <div className="flex items-start gap-3 min-w-0">
 <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
 <MapPin className="w-4 h-4 text-white" />
 </div>
 <span className="text-white/90 text-sm font-medium leading-relaxed break-words min-w-0">
 {locationLabel}
 </span>
 </div>
 </li>
                <li>
                  <a href={`tel:${phoneLink}`} className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white/90 active:text-white text-sm font-medium break-words min-w-0">
                      {supportPhone}
                    </span>
                  </a>
                </li>
 <li>
 <a href={`mailto:${supportEmail}`} className="flex items-start gap-3 min-w-0">
 <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
 <Mail className="w-4 h-4 text-white" />
 </div>
 <span className="text-white/90 active:text-white text-sm font-medium break-all min-w-0">
 {supportEmail}
 </span>
 </a>
 </li>
 </ul>
 </div>
 </div>
 </div>

 {/* Desktop Grid Layout */}
 <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-12 items-start gap-8 md:gap-9 lg:gap-x-8 lg:gap-y-8">
 {/* Brand */}
 <div className="text-center sm:text-left md:col-span-2 lg:col-span-3 min-w-0 self-start">
 <Link to="/" className="flex items-center gap-3 mb-6 md:mb-8 group justify-center sm:justify-start">
 <div className="h-16 w-40 md:h-20 md:w-48 lg:h-20 lg:w-48 flex items-center justify-center">
 <img 
 src="/images/f_logo.png" 
 alt="Naturanza Food" 
 className="h-full object-contain brightness-0 invert drop-shadow-2xl md:group-hover:drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
 />
 </div>
 </Link>
 <p className="text-white/90 mb-6 md:mb-10 max-w-sm text-xs sm:text-sm leading-relaxed font-medium mx-auto sm:mx-0">
 Pure Nature. Pure Health. Discover our range of premium organic products 
 sourced from sustainable farms around the world.
 </p>
 <div className="flex gap-2.5 md:gap-3 justify-center sm:justify-start">
 {socialLinks.map((social) => {
 const Icon = social.icon;
 return (
 <a
 key={`desktop-${social.label}`}
 href={social.href}
 target="_blank"
 rel="noopener noreferrer"
 aria-label={`Follow us on ${social.label}`}
 className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg md:rounded-xl flex items-center justify-center group shadow-lg shadow-black/20 active:scale-95 transition-all duration-300 md:hover:-translate-y-1 md:hover:bg-white/20 md:hover:border-emerald-200/70 md:hover:shadow-[0_0_0_1px_rgba(167,243,208,0.35),0_14px_30px_rgba(16,185,129,0.28)]"
 >
 <Icon className="w-4 h-4 md:w-5 md:h-5 text-white transition-all duration-300 md:group-hover:scale-110 md:group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]" />
 </a>
 );
 })}
 </div>
 </div>

 {/* Shop Links */}
 <div className="min-w-0 self-start lg:col-span-2 lg:pt-1">
 <h4 className="font-display font-bold text-base mb-5 text-white">Shop</h4>
 <ul className="space-y-3">
 {footerLinks.shop.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 md:hover:text-white text-sm font-medium inline-flex items-center gap-1.5 group transition-all duration-200 md:hover:translate-x-1 break-words"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>

 {/* Company Links */}
 <div className="min-w-0 self-start lg:col-span-2 lg:pt-1">
 <h4 className="font-display font-bold text-base mb-5 text-white">Company</h4>
 <ul className="space-y-3">
 {footerLinks.company.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 md:hover:text-white text-sm font-medium inline-flex items-center gap-1.5 group transition-all duration-200 md:hover:translate-x-1 break-words"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>

 {/* Support Links */}
 <div className="min-w-0 self-start lg:col-span-2 lg:pt-1">
 <h4 className="font-display font-bold text-base mb-5 text-white">Support</h4>
 <ul className="space-y-3">
 {footerLinks.support.map((link) => (
 <li key={link.label}>
 <Link
 to={link.path}
 className="text-white/70 md:hover:text-white text-sm font-medium inline-flex items-center gap-1.5 group transition-all duration-200 md:hover:translate-x-1 break-words"
 >
 {link.label}
 </Link>
 </li>
 ))}
 </ul>
 </div>

 {/* Contact */}
 <div className="min-w-0 self-start md:col-span-2 lg:col-span-3 lg:pr-0 lg:pt-1">
 <h4 className="font-display font-bold text-base mb-5 text-white">Get in Touch</h4>
 <ul className="space-y-3.5 max-w-[340px] ml-0 md:mx-auto lg:mx-0">
 <li className="group">
 <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
 <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
 <MapPin className="w-4 h-4 text-white" />
 </div>
 <span className="text-white/90 text-sm font-medium leading-snug break-words min-w-0">
 {locationLabel}
 </span>
 </div>
 </li>
 <li className="group">
 <a href={`tel:${phoneLink}`} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
 <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
 <Phone className="w-4 h-4 text-white" />
 </div>
 <span className="text-white/90 md:hover:text-white text-sm font-medium leading-snug break-words min-w-0">
 {supportPhone}
 </span>
 </a>
 </li>
 <li className="group">
 <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
 <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
 <Mail className="w-4 h-4 text-white" />
 </div>
 <span className="text-white/90 md:hover:text-white text-sm font-medium leading-snug break-all min-w-0">
 {supportEmail}
 </span>
 </a>
 </li>
 </ul>
 </div>
 </div>
 </div>

 {/* Bottom Bar — extra bottom/right padding keeps the legal links clear of the
 floating WhatsApp button (fixed bottom-5 right-5) */}
 <div className="border-t border-white/10 relative z-10">
 <div className="container-custom py-3 md:py-5 pb-20 md:pb-5">
 <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
  <p className="text-white/80 text-xs md:text-sm font-medium">
  © 2026 Naturanza Food. All rights reserved.
  </p>
  <div className="flex flex-wrap justify-center gap-3 md:gap-6 md:pr-16 lg:pr-20">
 <Link to="/terms" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
 Terms of Service
 </Link>
 <Link to="/privacy" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
 Privacy Policy
 </Link>
 <Link to="/cookies" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
 Cookies
 </Link>
 </div>
 </div>
 </div>
 </div>
 </footer>
 );
}
