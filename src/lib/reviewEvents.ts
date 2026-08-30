/**
 * In-process pub/sub for review changes, ported from
 * `frontend/src/utils/reviewEvents.js`.
 *
 * ⚠ TEMPORARY LOCATION. This is a shared utility, not a provider — it belongs
 * in `src/lib/reviewEvents.ts`. It sits here only because this migration phase
 * is scoped to `src/providers/`, and WishlistProvider subscribes to it.
 *
 * ⚠ IT IS A SINGLETON, AND THAT IS THE POINT. Publisher and subscriber must
 * import the *same module instance* or the wire is cut silently: the wishlist
 * would simply stop refreshing after a review is posted, with no error to
 * notice. When ReviewProvider and the product page are ported, move this file
 * and repoint both sides — do not let a second copy appear under `src/lib/`.
 *
 * Today nothing in `src/` emits (the only producer is
 * `frontend/src/pages/ProductDetail.jsx`), so the subscription below is
 * currently inert. It is kept so the behaviour returns the moment that page
 * lands, rather than being quietly dropped in the port.
 *
 * The listener map is module-level state. Under Next this module is also
 * evaluated on the server, where that state is per *process*; only client
 * components may call `on`/`emit`.
 */

export const REVIEW_EVENTS = {
  REVIEW_SUBMITTED: "review:submitted",
  REVIEW_UPDATED: "review:updated",
  REVIEW_DELETED: "review:deleted",
} as const;

export type ReviewEventName =
  (typeof REVIEW_EVENTS)[keyof typeof REVIEW_EVENTS];

export type ReviewEventListener = (data?: unknown) => void;

/** Unsubscribes the listener that returned it. */
export type ReviewEventUnsubscribe = () => void;

class ReviewEventEmitter {
  private readonly listeners = new Map<string, ReviewEventListener[]>();

  on(
    event: ReviewEventName,
    callback: ReviewEventListener,
  ): ReviewEventUnsubscribe {
    const existing = this.listeners.get(event);
    if (existing) {
      existing.push(callback);
    } else {
      this.listeners.set(event, [callback]);
    }

    // Return cleanup function
    return () => this.off(event, callback);
  }

  off(event: ReviewEventName, callback: ReviewEventListener): void {
    const existing = this.listeners.get(event);
    if (!existing) return;
    this.listeners.set(
      event,
      existing.filter((cb) => cb !== callback),
    );
  }

  emit(event: ReviewEventName, data?: unknown): void {
    const existing = this.listeners.get(event);
    if (!existing) return;
    existing.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /** Helper method to emit review submitted event */
  reviewSubmitted(reviewData?: unknown): void {
    this.emit(REVIEW_EVENTS.REVIEW_SUBMITTED, reviewData);
  }

  /** Helper method to listen for review submissions */
  onReviewSubmitted(callback: ReviewEventListener): ReviewEventUnsubscribe {
    return this.on(REVIEW_EVENTS.REVIEW_SUBMITTED, callback);
  }
}

export const reviewEvents = new ReviewEventEmitter();

export default reviewEvents;
