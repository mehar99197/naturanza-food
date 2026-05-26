# controllers/ — conventions

Controllers orchestrate a request: read `req`, call model functions, shape the JSON response.
Reference: `controllers/categoryController.js`.

## Skeleton

```js
const thingModel = require("../models/thingModel");

const getThingById = async (req, res) => {
  const thing = await thingModel.findById(req.params.id);
  if (!thing) {
    return res.status(404).json({ error: "Thing not found" });
  }
  return res.json(thing);
};

const createThing = async (req, res) => {
  const id = await thingModel.createThing(req.body);
  return res.status(201).json({ message: "Thing created successfully", thingId: id });
};

module.exports = { getThingById, createThing };
```

## Rules

- Plain `async (req, res) => {}`. **No try/catch** — `asyncHandler` (applied in the route) catches and forwards errors.
- **Return** the response: `return res.status(n).json(...)`. Status conventions: 200 read/update, 201 create, 400 bad input, 404 missing.
- **Thin controllers (SRP):** validation rules, uniqueness checks, and SQL belong in the **model**. Controllers only handle request/response wiring and lightweight shape checks (e.g. required field present, enum value valid).
- Errors thrown by models carry `statusCode`/`code` (via `createModelError`) and surface automatically — don't swallow them.
- Read inputs defensively: `req.body?.field`, `String(req.query?.x || "")`. Never trust client values.
- Success response shapes mirror the codebase: lists return arrays; mutations return `{ message, <entity>Id }`.
