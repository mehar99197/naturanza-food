const express = require("express");
const router = express.Router();
const { getAdminSettings, toPublicSettings } = require("../utils/adminSettings");
const {
  DEFAULT_SUPPORTED_CURRENCIES,
  getPkrExchangeRates,
  normalizeCurrencyList,
} = require("../utils/exchangeRates");

router.get("/", async (req, res) => {
  try {
    const settings = await getAdminSettings();
    res.json(toPublicSettings(settings));
  } catch (error) {
    res.status(500).json({ error: "Could not load settings" });
  }
});

router.get("/whatsapp", async (req, res) => {
  try {
    const settings = await getAdminSettings();
    // Prefer the dedicated whatsappNumber field; fall back to storePhone.
    // No hardcoded fallback — admin owns the value via the Settings page.
    res.json({
      whatsappNumber: settings.whatsappNumber || settings.storePhone || "",
      storeName: settings.storeName,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not load WhatsApp number" });
  }
});

router.get("/rates", async (req, res) => {
  try {
    const currencyParam = req.query.currencies || req.query.symbols || null;
    const requested = normalizeCurrencyList(currencyParam);
    const currencies = requested.length ? requested : DEFAULT_SUPPORTED_CURRENCIES;
    const rates = await getPkrExchangeRates(currencies);
    res.json(rates);
  } catch (error) {
    const statusCode = error.code === "EXCHANGE_APP_ID_MISSING" ? 503 : 500;
    res.status(statusCode).json({
      error:
        statusCode === 503
          ? "Exchange rates are not configured"
          : "Could not load exchange rates",
    });
  }
});

module.exports = router;
