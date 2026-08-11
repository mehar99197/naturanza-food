const test = require("node:test");
const assert = require("node:assert");

const createFakeDbPool = () => {
  let id = 0;
  const rows = new Map();

  const query = async (sql, params) => {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();

    if (/^SELECT \* FROM newsletter_subscribers WHERE email/i.test(normalizedSql)) {
      const email = String(params[0]).toLowerCase();
      const match = Array.from(rows.values()).find((r) => r.email === email);
      return [match ? [match] : []];
    }

    if (/^SELECT \* FROM newsletter_subscribers WHERE unsubscribe_token/i.test(normalizedSql)) {
      const token = String(params[0]);
      const match = Array.from(rows.values()).find((r) => r.unsubscribe_token === token);
      return [match ? [match] : []];
    }

    if (/^SELECT \* FROM newsletter_subscribers WHERE verification_token/i.test(normalizedSql)) {
      const token = String(params[0]);
      const match = Array.from(rows.values()).find((r) => r.verification_token === token);
      return [match ? [match] : []];
    }

    if (/^SELECT \* FROM newsletter_subscribers WHERE id/i.test(normalizedSql)) {
      const match = rows.get(Number(params[0]));
      return [match ? [match] : []];
    }

    if (/^INSERT INTO newsletter_subscribers/i.test(normalizedSql)) {
      id += 1;
      const [email, unsubscribeToken, verificationToken, verificationExpires, source] = params;
      rows.set(id, {
        id,
        email,
        status: "pending",
        unsubscribe_token: unsubscribeToken,
        verification_token: verificationToken,
        verification_token_expires_at: verificationExpires,
        source,
        subscribed_at: new Date(),
        verified_at: null,
        unsubscribed_at: null,
        reactivated_at: null,
      });
      return [{ insertId: id }];
    }

    if (/^UPDATE newsletter_subscribers SET status = 'active'/i.test(normalizedSql)) {
      const match = Array.from(rows.values()).find((r) => r.id === Number(params[0]));
      if (match) {
        match.status = "active";
        match.verified_at = new Date();
        match.verification_token = null;
        match.verification_token_expires_at = null;
      }
      return [{ affectedRows: match ? 1 : 0 }];
    }

    if (/^UPDATE newsletter_subscribers SET status = 'unsubscribed'/i.test(normalizedSql)) {
      const match = Array.from(rows.values()).find((r) => r.id === Number(params[0]));
      if (match) {
        match.status = "unsubscribed";
        match.unsubscribed_at = new Date();
      }
      return [{ affectedRows: match ? 1 : 0 }];
    }

    if (/^UPDATE newsletter_subscribers SET status = 'pending'/i.test(normalizedSql)) {
      const [unsubscribeToken, verificationToken, verificationExpires, , matchId] = params;
      const match = Array.from(rows.values()).find((r) => r.id === Number(matchId));
      if (match) {
        match.status = "pending";
        match.unsubscribe_token = unsubscribeToken;
        match.verification_token = verificationToken;
        match.verification_token_expires_at = verificationExpires;
        match.verified_at = null;
        match.unsubscribed_at = null;
        match.reactivated_at = new Date();
      }
      return [{ affectedRows: match ? 1 : 0 }];
    }

    if (/^UPDATE newsletter_subscribers SET verification_token_expires_at/i.test(normalizedSql)) {
      const match = Array.from(rows.values()).find((r) => r.id === Number(params[0]));
      if (match) {
        match.verification_token_expires_at = new Date(Date.now() - 60 * 60 * 1000);
      }
      return [{ affectedRows: match ? 1 : 0 }];
    }

    if (/^SELECT id, email, unsubscribe_token FROM newsletter_subscribers/i.test(normalizedSql)) {
      const matches = Array.from(rows.values())
        .filter((r) => r.status === "active")
        .sort((a, b) => a.id - b.id)
        .map((r) => ({ id: r.id, email: r.email, unsubscribe_token: r.unsubscribe_token }));
      return [matches];
    }

    if (/^DELETE FROM newsletter_subscribers/i.test(normalizedSql)) {
      const deleted = rows.delete(Number(params[0]));
      return [{ affectedRows: deleted ? 1 : 0 }];
    }

    return [[]];
  };

  return { query, getRows: () => rows };
};

const withNewsletterModel = (t, fn) => {
  const dbPath = require.resolve("../config/db");
  const original = require.cache[dbPath];
  const fake = createFakeDbPool();
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { dbPool: fake },
  };

  delete require.cache[require.resolve("../models/newsletterModel")];
  const newsletterModel = require("../models/newsletterModel");

  t.after(() => {
    if (original) {
      require.cache[dbPath] = original;
    } else {
      delete require.cache[dbPath];
    }
    delete require.cache[require.resolve("../models/newsletterModel")];
  });

  return fn(newsletterModel, fake);
};

test("newsletter subscribe returns pending verification state", async (t) => {
  await withNewsletterModel(t, async (newsletterModel) => {
    const email = `test-${Date.now()}@example.com`;
    const result = await newsletterModel.subscribe({ email, source: "test" });

    assert.equal(result.alreadySubscribed, false);
    assert.equal(result.pendingVerification, true);
    assert.equal(result.subscriber.status, "pending");
    assert.ok(result.subscriber.verification_token, "verification token is set");
    assert.ok(
      result.subscriber.verification_token_expires_at,
      "verification token expiry is set",
    );
  });
});

test("newsletter verification activates pending subscriber", async (t) => {
  await withNewsletterModel(t, async (newsletterModel) => {
    const email = `verify-${Date.now()}@example.com`;
    const { subscriber } = await newsletterModel.subscribe({ email, source: "test" });
    const verified = await newsletterModel.verifyByToken(subscriber.verification_token);

    assert.equal(verified.status, "active");
    assert.equal(verified.email, email.toLowerCase());
  });
});

test("newsletter verification fails with expired token", async (t) => {
  await withNewsletterModel(t, async (newsletterModel, fake) => {
    const email = `expired-${Date.now()}@example.com`;
    const { subscriber } = await newsletterModel.subscribe({ email, source: "test" });

    await fake.query(
      "UPDATE newsletter_subscribers SET verification_token_expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?",
      [subscriber.id],
    );

    await assert.rejects(
      () => newsletterModel.verifyByToken(subscriber.verification_token),
      (err) => err.code === "NEWSLETTER_TOKEN_EXPIRED",
    );
  });
});

test("newsletter unsubscribe works from pending state", async (t) => {
  await withNewsletterModel(t, async (newsletterModel) => {
    const email = `unsub-${Date.now()}@example.com`;
    const { subscriber } = await newsletterModel.subscribe({ email, source: "test" });
    const unsubscribed = await newsletterModel.unsubscribeByToken(subscriber.unsubscribe_token);

    assert.equal(unsubscribed.status, "unsubscribed");
  });
});

test("newsletter broadcast only targets active subscribers", async (t) => {
  await withNewsletterModel(t, async (newsletterModel) => {
    const activeEmail = `active-${Date.now()}@example.com`;
    const pendingEmail = `pending-${Date.now()}@example.com`;

    const activeSub = await newsletterModel.subscribe({ email: activeEmail, source: "test" });
    await newsletterModel.verifyByToken(activeSub.subscriber.verification_token);

    await newsletterModel.subscribe({ email: pendingEmail, source: "test" });

    const activeList = await newsletterModel.listActiveForBroadcast();
    const emails = activeList.map((s) => s.email);

    assert.ok(emails.includes(activeEmail.toLowerCase()), "active subscriber included");
    assert.ok(!emails.includes(pendingEmail.toLowerCase()), "pending subscriber excluded");
  });
});
